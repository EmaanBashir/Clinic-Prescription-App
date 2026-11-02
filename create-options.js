
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Create data directory
const dataDirectory = path.join(__dirname, 'data');

if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
}

// Workbook location
const filePath = path.join(
    dataDirectory,
    'Prescription_Options.xlsx'
);

// Create workbook
const workbook = XLSX.utils.book_new();

// Default options for each worksheet
const sheets = {

    Investigations: [
        ['Option'],
        ['Blood CP'],
        ['LFTs'],
        ['RFTs'],
        ['Blood Glucose'],
        ['Lipid Profile'],
        ['Urine R/E'],
        ['HbA1c'],
        ['ESR'],
        ['CRP'],
        ['Thyroid Function Tests'],
        ['ECG'],
        ['Chest X-Ray']
    ],

    Medicines: [
        ['Option'],
        ['Tab Panadol 500mg'],
        ['Tab Paracetamol 500mg'],
        ['Tab Ibuprofen 400mg'],
        ['Tab Amoxicillin 500mg']
    ],

    Dosage: [
        ['Option'],
        ['Once daily'],
        ['Twice daily'],
        ['Thrice daily'],
        ['2 in the morning, evening, night'],
        ['1 tablet daily']
    ],

    Timing: [
        ['Option'],
        ['Before eating food'],
        ['Half an hour before eating food'],
        ['After eating food'],
        ['Half an hour after eating food'],
        ['With food']
    ],

    Duration: [
        ['Option'],
        ['For three days'],
        ['For five consecutive days'],
        ['For seven days'],
        ['For two weeks'],
        ['For one month']
    ]

};

// Create all five worksheets
for (const [sheetName, data] of Object.entries(sheets)) {

    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Set column width
    worksheet['!cols'] = [{ wch: 45 }];

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        sheetName
    );

}

// Save workbook
XLSX.writeFile(workbook, filePath);

console.log('Excel workbook created successfully!');
console.log(filePath);
