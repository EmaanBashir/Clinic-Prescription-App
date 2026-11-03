
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const Database = require('better-sqlite3');

let mainWindow;
let db;
let workbookPath;
let databasePath;


// =====================================
// 1. APPLICATION DATA PATHS
// =====================================

function initialiseAppPaths() {

    const userDataPath = app.getPath('userData');

    workbookPath = path.join(
        userDataPath,
        'Prescription_Options.xlsx'
    );

    databasePath = path.join(
        userDataPath,
        'Prescription_Manager.db'
    );

}


// =====================================
// 2. EXCEL WORKBOOK
// =====================================

function initialiseWorkbook() {

    if (fs.existsSync(workbookPath)) {
        return;
    }

    // In development, use the workbook in the project's data folder.
    // In the packaged application, use the copy included with the installer.
    const sourcePath = app.isPackaged
        ? path.join(
            process.resourcesPath,
            'data',
            'Prescription_Options.xlsx'
        )
        : path.join(
            __dirname,
            'data',
            'Prescription_Options.xlsx'
        );

    if (!fs.existsSync(sourcePath)) {
        throw new Error(
            'The default Prescription_Options.xlsx workbook could not be found.'
        );
    }

    fs.mkdirSync(path.dirname(workbookPath), {
        recursive: true
    });

    fs.copyFileSync(sourcePath, workbookPath);

}


function readOptions() {

    try {

        initialiseWorkbook();

        const workbook = XLSX.readFile(workbookPath);

        const requiredSheets = [
            'Investigations',
            'Medicines',
            'Dosage',
            'Timing',
            'Duration'
        ];

        const options = {};

        for (const sheetName of requiredSheets) {

            const worksheet = workbook.Sheets[sheetName];

            if (!worksheet) {
                throw new Error(
                    `The worksheet "${sheetName}" is missing.`
                );
            }

            const rows = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                defval: ''
            });

            // Skip the first row, which contains the "Option" heading.
            options[sheetName] = rows
                .slice(1)
                .map(row => String(row[0] ?? '').trim())
                .filter(value => value.length > 0);

        }

        return {
            success: true,
            options
        };

    } catch (error) {

        console.error('Error reading Excel options:', error);

        return {
            success: false,
            message: error.message
        };

    }

}


// =====================================
// 3. SQLITE DATABASE
// =====================================

function initialiseDatabase() {

    try {

        // Create the database if it does not already exist.
        db = new Database(databasePath);

        // Enforce patient-prescription relationships.
        db.pragma('foreign_keys = ON');

        // Improve reliability when the application is interrupted.
        db.pragma('journal_mode = WAL');


        // PATIENTS TABLE
        db.exec(`
            CREATE TABLE IF NOT EXISTS patients (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                mr_number TEXT NOT NULL UNIQUE,

                patient_name TEXT NOT NULL,

                age TEXT,

                gender TEXT,

                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

            );
        `);


        // PRESCRIPTIONS TABLE
        db.exec(`
            CREATE TABLE IF NOT EXISTS prescriptions (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                patient_id INTEGER NOT NULL,

                prescription_date TEXT NOT NULL,

                bp TEXT,

                pulse TEXT,

                temperature TEXT,

                investigations_json TEXT NOT NULL DEFAULT '[]',

                treatments_json TEXT NOT NULL DEFAULT '[]',

                followup TEXT,

                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (patient_id)
                    REFERENCES patients(id)
                    ON DELETE RESTRICT

            );
        `);


        // Indexes help searches by patient and prescription date.
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_prescriptions_patient
            ON prescriptions(patient_id);

            CREATE INDEX IF NOT EXISTS idx_prescriptions_date
            ON prescriptions(prescription_date);
        `);


        console.log('SQLite database initialised successfully.');

    } catch (error) {

        console.error('Database initialisation failed:', error);

        throw error;

    }

}


// =====================================
// 4. CREATE APPLICATION WINDOW
// =====================================

function createWindow() {

    mainWindow = new BrowserWindow({

        width: 1250,
        height: 850,

        minWidth: 1000,
        minHeight: 700,

        title: 'Prescription Manager',

        webPreferences: {

            preload: path.join(__dirname, 'preload.js'),

            nodeIntegration: false,

            contextIsolation: true

        }

    });

    mainWindow.loadFile('index.html');

}


// =====================================
// 5. EXCEL IPC HANDLERS
// =====================================

// Read the options from the workbook.
ipcMain.handle('options:load', () => {

    return readOptions();

});


// Open the editable workbook in the computer's default spreadsheet application.
ipcMain.handle('options:open-workbook', async () => {

    try {

        initialiseWorkbook();

        const errorMessage = await shell.openPath(workbookPath);

        if (errorMessage) {

            return {
                success: false,
                message: errorMessage
            };

        }

        return {
            success: true
        };

    } catch (error) {

        console.error('Error opening workbook:', error);

        return {
            success: false,
            message: error.message
        };

    }

});



// =====================================
// 6. SAVE OR UPDATE PRESCRIPTION
// =====================================

ipcMain.handle('prescription:save', (event, prescription) => {

    try {

        // Basic validation
        if (!prescription || typeof prescription !== 'object') {
            throw new Error('Invalid prescription information.');
        }

        let mrNumber = String(prescription.mrNumber || '').trim();

        const patientName = String(prescription.patientName || '').trim();
        const prescriptionDate = String(
            prescription.prescriptionDate || ''
        ).trim();

        if (!patientName || !prescriptionDate) {
            throw new Error(
                'Patient name and prescription date are required.'
            );
        }

        const investigationsJson = JSON.stringify(
            prescription.investigations || []
        );

        const treatmentsJson = JSON.stringify(
            prescription.treatments || []
        );

        const saveTransaction = db.transaction(() => {

            // Generate a unique NA number if the doctor has not entered an MR number.
            if (!mrNumber) {

                const existingNumbers = db.prepare(`
        SELECT mr_number
        FROM patients
        WHERE mr_number GLOB 'NA[0-9]*'
    `).all();

                let highestNumber = 0;

                existingNumbers.forEach(record => {

                    const match = record.mr_number.match(/^NA(\d+)$/);

                    if (match) {
                        highestNumber = Math.max(
                            highestNumber,
                            Number(match[1])
                        );
                    }

                });

                do {
                    highestNumber++;
                    mrNumber = `NA${String(highestNumber).padStart(4, '0')}`;

                } while (db.prepare(`
        SELECT id FROM patients WHERE mr_number = ?
    `).get(mrNumber));

            }

            // Find an existing patient by MR number.
            let patient = db.prepare(`
    SELECT id
    FROM patients
    WHERE mr_number = ?
`).get(mrNumber);

            let patientId;

            if (patient) {

                db.prepare(`
                    UPDATE patients
                    SET
                        patient_name = ?,
                        age = ?,
                        gender = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(
                    patientName,
                    prescription.age || '',
                    prescription.gender || '',
                    patient.id
                );

                patientId = patient.id;

            } else {

                const result = db.prepare(`
                    INSERT INTO patients (
                        mr_number,
                        patient_name,
                        age,
                        gender
                    )
                    VALUES (?, ?, ?, ?)
                `).run(
                    mrNumber,
                    patientName,
                    prescription.age || '',
                    prescription.gender || ''
                );

                patientId = result.lastInsertRowid;

            }

            let prescriptionId;

            if (prescription.prescriptionId) {

                // Update an existing prescription.
                const result = db.prepare(`
                    UPDATE prescriptions
                    SET
                        patient_id = ?,
                        prescription_date = ?,
                        bp = ?,
                        pulse = ?,
                        temperature = ?,
                        investigations_json = ?,
                        treatments_json = ?,
                        followup = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(
                    patientId,
                    prescriptionDate,
                    prescription.bp || '',
                    prescription.pulse || '',
                    prescription.temperature || '',
                    investigationsJson,
                    treatmentsJson,
                    prescription.followup || '',
                    prescription.prescriptionId
                );

                if (result.changes === 0) {
                    throw new Error(
                        'The prescription could not be found. It may have been deleted.'
                    );
                }

                prescriptionId = prescription.prescriptionId;

            } else {

                // Insert a new prescription.
                const result = db.prepare(`
                    INSERT INTO prescriptions (
                        patient_id,
                        prescription_date,
                        bp,
                        pulse,
                        temperature,
                        investigations_json,
                        treatments_json,
                        followup
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    patientId,
                    prescriptionDate,
                    prescription.bp || '',
                    prescription.pulse || '',
                    prescription.temperature || '',
                    investigationsJson,
                    treatmentsJson,
                    prescription.followup || ''
                );

                prescriptionId = result.lastInsertRowid;

            }

            return {
                prescriptionId,
                patientId,
                mrNumber
            };

        });

        const savedRecord = saveTransaction();

        console.log(
            'Prescription saved or updated:',
            savedRecord.prescriptionId
        );

        return {
            success: true,
            ...savedRecord
        };

    } catch (error) {

        console.error('Error saving prescription:', error);

        return {
            success: false,
            message: error.message
        };

    }

});


// =====================================
// 7. LOAD PRESCRIPTION HISTORY
// =====================================

ipcMain.handle('prescription:history', () => {

    try {

        const prescriptions = db.prepare(`
            SELECT
                prescriptions.id,
                prescriptions.prescription_date,
                prescriptions.bp,
                prescriptions.pulse,
                prescriptions.temperature,
                prescriptions.investigations_json,
                prescriptions.treatments_json,
                prescriptions.followup,
                prescriptions.created_at,

                patients.mr_number,
                patients.patient_name,
                patients.age,
                patients.gender

            FROM prescriptions

            INNER JOIN patients
                ON prescriptions.patient_id = patients.id

            ORDER BY
                prescriptions.prescription_date DESC,
                prescriptions.id DESC
        `).all();

        return {
            success: true,
            prescriptions
        };

    } catch (error) {

        console.error('Error loading prescription history:', error);

        return {
            success: false,
            message: error.message
        };

    }

});


// =====================================
// DELETE PRESCRIPTION
// =====================================

ipcMain.handle('prescription:delete', (event, prescriptionId) => {

    try {

        const id = Number(prescriptionId);

        if (!Number.isInteger(id) || id <= 0) {
            throw new Error('Invalid prescription ID.');
        }

        const result = db.prepare(`
            DELETE FROM prescriptions
            WHERE id = ?
        `).run(id);

        if (result.changes === 0) {
            throw new Error(
                'The prescription could not be found. It may already have been deleted.'
            );
        }

        console.log('Prescription deleted:', id);

        return {
            success: true
        };

    } catch (error) {

        console.error('Error deleting prescription:', error);

        return {
            success: false,
            message: error.message
        };

    }

});


// =====================================
// DASHBOARD STATISTICS
// =====================================

ipcMain.handle('dashboard:statistics', () => {

    try {

        const statistics = db.prepare(`
            SELECT
                (SELECT COUNT(*) FROM prescriptions) AS total_prescriptions,
                (SELECT COUNT(*) FROM patients) AS total_patients,
                (
                    SELECT COUNT(*)
                    FROM prescriptions
                    WHERE strftime('%Y-%m', prescription_date) = strftime('%Y-%m', 'now', 'localtime')
                ) AS prescriptions_this_month
        `).get();

        return {
            success: true,
            statistics
        };

    } catch (error) {

        console.error('Error loading dashboard statistics:', error);

        return {
            success: false,
            message: error.message
        };

    }

});


// =====================================
// PRINT PRESCRIPTION
// =====================================

ipcMain.handle('prescription:print', (event) => {

    return new Promise((resolve) => {

        try {

            event.sender.print({
                silent: false,
                printBackground: true,
                color: true,
                landscape: false,
                pageSize: 'A4',
                margins: { marginType: 'none' },
                scaleFactor: 100
            }, (success, failureReason) => {

                resolve({
                    success,
                    message: failureReason || ''
                });

            });

        } catch (error) {

            resolve({
                success: false,
                message: error.message
            });

        }

    });

});


// =====================================
// LOAD PATIENTS
// =====================================

ipcMain.handle('patients:list', () => {

    try {

        const patients = db.prepare(`
            SELECT
                patients.id,
                patients.mr_number,
                patients.patient_name,
                patients.age,
                patients.gender,
                COUNT(prescriptions.id) AS prescription_count

            FROM patients

            LEFT JOIN prescriptions
                ON patients.id = prescriptions.patient_id

            GROUP BY patients.id

            ORDER BY patients.patient_name COLLATE NOCASE ASC
        `).all();

        return {
            success: true,
            patients
        };

    } catch (error) {

        console.error('Error loading patients:', error);

        return {
            success: false,
            message: error.message
        };

    }

});


// =====================================
// DELETE PATIENT AND ASSOCIATED PRESCRIPTIONS
// =====================================

ipcMain.handle('patients:delete', (event, patientId) => {

    try {

        const id = Number(patientId);

        if (!Number.isSafeInteger(id) || id <= 0) {
            throw new Error('Invalid patient ID.');
        }

        // Delete the prescriptions and patient together.
        // If either operation fails, the transaction is rolled back.
        const deleteTransaction = db.transaction(() => {

            const patient = db.prepare(`
                SELECT id
                FROM patients
                WHERE id = ?
            `).get(id);

            if (!patient) {
                throw new Error('Patient could not be found.');
            }

            db.prepare(`
                DELETE FROM prescriptions
                WHERE patient_id = ?
            `).run(id);

            db.prepare(`
                DELETE FROM patients
                WHERE id = ?
            `).run(id);

        });

        deleteTransaction();

        console.log('Patient and associated prescriptions deleted:', id);

        return {
            success: true
        };

    } catch (error) {

        console.error('Error deleting patient:', error);

        return {
            success: false,
            message: error.message
        };

    }

});


// =====================================
// APPLICATION STARTUP
// =====================================

app.whenReady().then(() => {

    try {

        initialiseAppPaths();

        initialiseDatabase();

        createWindow();

    } catch (error) {

        console.error('Application startup failed:', error);

        app.quit();

        return;

    }

    app.on('activate', () => {

        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }

    });

});


// =====================================
// APPLICATION SHUTDOWN
// =====================================

app.on('before-quit', () => {

    if (db) {

        db.close();

        db = null;

        console.log('SQLite database connection closed.');

    }

});


app.on('window-all-closed', () => {

    if (process.platform !== 'darwin') {
        app.quit();
    }

});
