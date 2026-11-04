
document.addEventListener('DOMContentLoaded', () => {

    // =====================================
    // 1. PAGE NAVIGATION
    // =====================================

    const navigationButtons =
        document.querySelectorAll('[data-page]');

    const pages =
        document.querySelectorAll('.page');

    const pageTitle =
        document.getElementById('page-title');

    const titles = {
        dashboard: 'Dashboard',
        new: 'New Prescription',
        history: 'Prescription History',
        patients: 'Patients',
        lists: 'Manage Lists'
    };

    navigationButtons.forEach(button => {

        button.addEventListener('click', () => {

            const selectedPage = button.dataset.page;

            pages.forEach(page => {
                page.classList.remove('active');
            });

            document.getElementById(selectedPage)
                .classList.add('active');

            pageTitle.textContent = titles[selectedPage];

            document.querySelectorAll('.nav-button')
                .forEach(nav => nav.classList.remove('active'));

            const activeButton = document.querySelector(
                `.nav-button[data-page="${selectedPage}"]`
            );

            if (activeButton) {
                activeButton.classList.add('active');
            }

            if (selectedPage === 'new') {
                updatePreview();
                scalePreview();
            }

            if (selectedPage === 'history') {

                const patientMRNumber = requestedPatientHistory;

                requestedPatientHistory = null;

                loadPrescriptionHistory(patientMRNumber);

            }

            if (selectedPage === 'patients') {
                loadPatients();
            }

            if (selectedPage === 'dashboard') {
                loadDashboardStatistics();
            }

        });

    });


    // =====================================
    // 2. DEFAULT DATE
    // =====================================

    const dateInput =
        document.getElementById('prescription-date');

    function getLocalDate() {

        const now = new Date();

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    dateInput.value = getLocalDate();


    // =====================================
    // 3. EXCEL DROPDOWN OPTIONS
    // =====================================

    let options = {
        medicines: [],
        dosage: [],
        timing: [],
        duration: []
    };


    // =====================================
    // 4. HELPER FUNCTIONS
    // =====================================

    function createElement(tag, className, text) {

        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    function getValue(id) {

        return document.getElementById(id).value.trim();

    }

    function setPreview(id, value) {

        document.getElementById(id).textContent = value || '';

    }

    function formatDate(value) {

        if (!value) return '';

        const [year, month, day] = value.split('-');

        return `${day}/${month}/${year}`;

    }

    // =====================================
    // PRESCRIPTION HISTORY
    // =====================================

    let currentHistoryRecords = [];
    let historyLoadRequest = 0;
    let requestedPatientHistory = null;

    let historyVisibleCount = 40;
    let currentHistoryPatientMRNumber = null;

    async function loadPrescriptionHistory(
        patientMRNumber = null,
        preserveVisibleCount = false
    ) {

        const requestId = ++historyLoadRequest;
        currentHistoryPatientMRNumber = patientMRNumber;

        if (!preserveVisibleCount) {
            historyVisibleCount = 40;
        }

        const status = document.getElementById('history-status');
        const tableBody = document.getElementById('history-table-body');
        const detailPanel = document.getElementById('history-detail');

        const loadMoreButton =
            document.getElementById('history-load-more');

        loadMoreButton.hidden = true;

        status.textContent = 'Loading prescriptions...';
        tableBody.replaceChildren();
        detailPanel.hidden = true;

        try {

            const result =
                await window.prescriptionDatabase.getHistory();

            // Ignore an older request if a newer one has started.
            if (requestId !== historyLoadRequest) return;

            if (!result.success) {
                throw new Error(result.message);
            }

            currentHistoryRecords = result.prescriptions;

            let prescriptions = currentHistoryRecords;

            // Filter records when a particular patient was selected.
            if (patientMRNumber !== null) {

                prescriptions = prescriptions.filter(
                    prescription =>
                        String(prescription.mr_number) === String(patientMRNumber)
                );

            }

            // Filter records by a specific date.
            const selectedDate =
                document.getElementById('history-date-filter').value;

            if (selectedDate) {
                prescriptions = prescriptions.filter(
                    prescription =>
                        prescription.prescription_date === selectedDate
                );
            }

            // Filter records by month.
            const selectedMonth =
                document.getElementById('history-month-filter').value;

            if (selectedMonth) {
                prescriptions = prescriptions.filter(
                    prescription =>
                        prescription.prescription_date.startsWith(selectedMonth)
                );
            }

            if (prescriptions.length === 0) {

                status.textContent = patientMRNumber !== null
                    ? 'No prescriptions found for this patient.'
                    : 'No prescriptions have been saved yet.';

                return;

            }

            const displayedCount = Math.min(
                historyVisibleCount,
                prescriptions.length
            );

            status.textContent = patientMRNumber !== null
                ? `${displayedCount} of ${prescriptions.length} prescription(s) for the selected patient.`
                : `${displayedCount} of ${prescriptions.length} prescription(s) displayed.`;

            loadMoreButton.hidden =
                displayedCount >= prescriptions.length;

            prescriptions.slice(0, historyVisibleCount).forEach(prescription => {

                const row = document.createElement('tr');

                const values = [
                    formatDate(prescription.prescription_date),
                    prescription.patient_name,
                    prescription.mr_number,
                    prescription.age,
                    prescription.gender
                ];

                values.forEach(value => {

                    const cell = document.createElement('td');
                    cell.textContent = value || '—';
                    row.appendChild(cell);

                });

                const actionCell = document.createElement('td');

                const viewButton = document.createElement('button');
                viewButton.type = 'button';
                viewButton.className = 'secondary-button';
                viewButton.textContent = 'View';

                viewButton.addEventListener('click', () => {
                    viewPrescription(prescription);
                });

                const editButton = document.createElement('button');
                editButton.type = 'button';
                editButton.className = 'secondary-button';
                editButton.textContent = 'Edit';

                editButton.addEventListener('click', () => {
                    editPrescription(prescription);
                });
                actionCell.style.display = 'flex';
                actionCell.style.gap = '8px';
                actionCell.appendChild(viewButton);
                actionCell.appendChild(editButton);
                const deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.className = 'delete-button';
                deleteButton.textContent = 'Delete';

                deleteButton.addEventListener('click', async () => {

                    const confirmed = confirm(
                        'Are you sure you want to delete this prescription? This action cannot be undone.'
                    );

                    if (!confirmed) {
                        return;
                    }

                    const result = await window.prescriptionDatabase.delete(
                        prescription.id
                    );

                    if (result.success) {
                        alert('Prescription deleted successfully.');
                        loadPrescriptionHistory();
                    } else {
                        alert('Unable to delete prescription: ' + result.message);
                    }

                });

                actionCell.appendChild(deleteButton);
                row.appendChild(actionCell);

                tableBody.appendChild(row);

            });

        } catch (error) {

            if (requestId !== historyLoadRequest) return;

            console.error('Error loading prescription history:', error);

            status.textContent =
                `Could not load prescription history: ${error.message}`;

        }

    }

    // Load the next 20 prescriptions.
    document.getElementById('history-load-more')
        .addEventListener('click', () => {

            historyVisibleCount += 40;

            loadPrescriptionHistory(
                currentHistoryPatientMRNumber,
                true
            );

        });

    // Reload history when the date filter changes.
    document.getElementById('history-date-filter')
        .addEventListener('change', () => {
            loadPrescriptionHistory(currentHistoryPatientMRNumber);
        });

    // Reload history when the month filter changes.
    document.getElementById('history-month-filter')
        .addEventListener('change', () => {
            loadPrescriptionHistory(currentHistoryPatientMRNumber);
        });

    // Clear both date and month filters.
    document.getElementById('clear-history-filters')
        .addEventListener('click', () => {

            document.getElementById('history-date-filter').value = '';
            document.getElementById('history-month-filter').value = '';

            loadPrescriptionHistory(currentHistoryPatientMRNumber);

        });

    // Display the details of a selected prescription.

    function viewPrescription(prescription) {

        const detailPanel = document.getElementById('history-detail');
        const content = document.getElementById('history-detail-content');

        content.replaceChildren();

        function addDetail(label, value) {

            const paragraph = document.createElement('p');
            const strong = document.createElement('strong');

            strong.textContent = `${label}: `;

            paragraph.appendChild(strong);
            paragraph.appendChild(
                document.createTextNode(value || '—')
            );

            content.appendChild(paragraph);

        }

        function parseJson(value) {

            try {
                return JSON.parse(value || '[]');
            } catch {
                return [];
            }

        }

        addDetail('Patient Name', prescription.patient_name);
        addDetail('MR Number', prescription.mr_number);
        addDetail('Age', prescription.age);
        addDetail('Gender', prescription.gender);
        addDetail('Date', formatDate(prescription.prescription_date));

        addDetail('Blood Pressure', prescription.bp);
        addDetail('Pulse', prescription.pulse);
        addDetail('Temperature', prescription.temperature);
        addDetail('Additional Notes', prescription.observations_notes);

        const investigations = parseJson(
            prescription.investigations_json
        );

        addDetail(
            'Investigations',
            investigations.length ? investigations.join(', ') : '—'
        );

        const treatments = parseJson(
            prescription.treatments_json
        );

        const treatmentLines = treatments.map((treatment, index) => {

            const details = [
                treatment.medicine,
                treatment.dosage,
                treatment.timing,
                treatment.duration
            ].filter(Boolean).join(' | ');

            return `${index + 1}. ${details || '—'}`;

        });

        addDetail(
            'Treatments',
            treatmentLines.length ? treatmentLines.join('\n') : '—'
        );

        addDetail('Follow-up', prescription.followup);

        detailPanel.hidden = false;
        detailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    }


    // Load an existing prescription into the form for editing.

    function editPrescription(prescription) {

        // Store the ID of the prescription being edited.
        editingPrescriptionId = prescription.id;

        // Populate patient details.
        document.getElementById('mr-number').value =
            prescription.mr_number || '';

        document.getElementById('patient-name').value =
            prescription.patient_name || '';

        document.getElementById('patient-age').value =
            prescription.age || '';

        document.getElementById('patient-gender').value =
            prescription.gender || '';

        // Populate prescription date and observations.
        dateInput.value = prescription.prescription_date || '';

        document.getElementById('bp').value =
            prescription.bp || '';

        document.getElementById('pulse').value =
            prescription.pulse || '';

        document.getElementById('temperature').value =
            prescription.temperature || '';

        document.getElementById('observations-notes').value =
            prescription.observations_notes || '';

        document.getElementById('followup').value =
            prescription.followup || '';

        // Restore selected investigations.
        selectedInvestigations.clear();

        try {

            const investigations = JSON.parse(
                prescription.investigations_json || '[]'
            );

            investigations.forEach(test => {
                selectedInvestigations.add(test);
            });

        } catch (error) {

            console.error('Could not load investigations:', error);

        }

        // Restore treatment cards.
        treatmentContainer.replaceChildren();

        treatmentCounter = 0;

        let treatments = [];

        try {

            treatments = JSON.parse(
                prescription.treatments_json || '[]'
            );

        } catch (error) {

            console.error('Could not load treatments:', error);

        }

        if (treatments.length === 0) {

            addTreatment();

        } else {

            treatments.forEach(treatment => {

                addTreatment();

                const card =
                    treatmentContainer.lastElementChild;

                const treatmentId = card.dataset.treatmentId;

                document.getElementById(
                    `treatment-${treatmentId}-medicine`
                ).value = treatment.medicine || '';

                document.getElementById(
                    `treatment-${treatmentId}-dosage`
                ).value = treatment.dosage || '';

                document.getElementById(
                    `treatment-${treatmentId}-timing`
                ).value = treatment.timing || '';

                document.getElementById(
                    `treatment-${treatmentId}-duration`
                ).value = treatment.duration || '';

            });

        }

        // Refresh the investigation checklist and preview.
        renderInvestigations();

        updatePreview();

        // Navigate to the New Prescription page.
        document.querySelector(
            '.nav-button[data-page="new"]'
        ).click();

        // Ensure the preview reflects the loaded information.
        updatePreview();

        alert(
            'Prescription loaded for editing. Make your changes and print when ready.'
        );

    }


    // =====================================
    // PATIENTS
    // =====================================

    let allPatients = [];
    let patientsVisibleCount = 40;

    async function loadPatients() {

        const status = document.getElementById('patients-status');

        try {

            status.textContent = 'Loading patients...';

            const result =
                await window.prescriptionDatabase.getPatients();

            if (!result.success) {
                throw new Error(result.message);
            }

            allPatients = result.patients;

            renderPatients();

        } catch (error) {

            console.error('Error loading patients:', error);

            status.textContent =
                `Could not load patients: ${error.message}`;

        }

    }

    // =====================================
    // LOAD DASHBOARD STATISTICS
    // =====================================

    async function loadDashboardStatistics() {

        const result = await window.prescriptionDatabase.getDashboardStatistics();

        if (!result.success) {
            console.error('Error loading dashboard statistics:', result.message);
            return;
        }

        document.getElementById('total-prescriptions').textContent =
            result.statistics.total_prescriptions;

        document.getElementById('total-patients').textContent =
            result.statistics.total_patients;

    }

    function renderPatients() {

        const tableBody =
            document.getElementById('patients-table-body');

        const status =
            document.getElementById('patients-status');

        const loadMoreButton =
            document.getElementById('patients-load-more');

        loadMoreButton.hidden = true;

        const searchText = document
            .getElementById('patient-search')
            .value.trim()
            .toLowerCase();

        tableBody.replaceChildren();

        const filteredPatients = allPatients.filter(patient => {

            return (
                (patient.patient_name || '').toLowerCase().includes(searchText) ||
                (patient.mr_number || '').toLowerCase().includes(searchText)
            );

        });

        if (allPatients.length === 0) {

            status.textContent = 'No patients have been registered yet.';
            return;

        }

        if (filteredPatients.length === 0) {

            status.textContent = 'No matching patients found.';
            return;

        }

        const displayedCount = Math.min(
            patientsVisibleCount,
            filteredPatients.length
        );

        status.textContent =
            `${displayedCount} of ${filteredPatients.length} matching patient(s) displayed.`;

        loadMoreButton.hidden =
            displayedCount >= filteredPatients.length;

        filteredPatients.slice(0, patientsVisibleCount).forEach(patient => {

            const row = document.createElement('tr');

            const values = [
                patient.patient_name,
                patient.mr_number,
                patient.age,
                patient.gender,
                patient.prescription_count
            ];

            values.forEach(value => {

                const cell = document.createElement('td');
                cell.textContent = value || '—';

                row.appendChild(cell);

            });

            const actionCell = document.createElement('td');

            const viewButton = document.createElement('button');

            viewButton.type = 'button';
            viewButton.className = 'secondary-button';
            viewButton.textContent = 'View History';


            viewButton.addEventListener('click', () => {

                showPatientHistory(patient);

            });

            // Delete patient and all associated prescriptions.
            const deleteButton = document.createElement('button');

            deleteButton.type = 'button';
            deleteButton.className = 'delete-button';
            deleteButton.textContent = 'Delete';

            deleteButton.addEventListener('click', async () => {

                const prescriptionCount = Number(
                    patient.prescription_count
                ) || 0;

                const confirmed = confirm(
                    `Are you sure you want to delete ${patient.patient_name} (${patient.mr_number})?\n\n` +
                    `This will permanently delete the patient and all ${prescriptionCount} associated prescription(s).\n\n` +
                    'This action cannot be undone.'
                );

                if (!confirmed) {
                    return;
                }

                deleteButton.disabled = true;

                try {

                    const result =
                        await window.prescriptionDatabase.deletePatient(
                            patient.id
                        );

                    if (!result.success) {
                        throw new Error(result.message);
                    }

                    alert(
                        'Patient and all associated prescriptions have been deleted successfully.'
                    );

                    // Refresh the patient list and dashboard statistics.
                    await loadPatients();
                    await loadDashboardStatistics();

                } catch (error) {

                    console.error('Error deleting patient:', error);

                    alert(
                        `Unable to delete patient: ${error.message}`
                    );

                    deleteButton.disabled = false;

                }

            });

            actionCell.style.display = 'flex';
            actionCell.style.gap = '8px';

            actionCell.appendChild(viewButton);
            actionCell.appendChild(deleteButton);

            row.appendChild(actionCell);


            tableBody.appendChild(row);

        });

    }


    // Search patients as the doctor types.

    document.getElementById('patient-search')
        .addEventListener('input', renderPatients);

    // Reset pagination when the search changes.
    document.getElementById('patient-search')
        .addEventListener('input', () => {
            patientsVisibleCount = 40;
        });

    // Display the next 40 patients.
    document.getElementById('patients-load-more')
        .addEventListener('click', () => {

            patientsVisibleCount += 40;

            renderPatients();

        });

    // Show all prescriptions belonging to a selected patient.

    function showPatientHistory(patient) {

        requestedPatientHistory = patient.mr_number;

        const historyButton = document.querySelector(
            '.nav-button[data-page="history"]'
        );

        historyButton.click();

    }

    // =====================================
    // LOAD OPTIONS FROM EXCEL WORKBOOK
    // =====================================

    const optionsStatus = document.getElementById('options-status');

    async function loadExcelOptions() {

        optionsStatus.textContent = 'Loading Excel options...';

        try {

            const result = await window.prescriptionOptions.load();

            if (!result.success) {
                throw new Error(result.message);
            }

            const excelOptions = result.options;

            investigationOptions = excelOptions.Investigations || [];

            options.medicines = excelOptions.Medicines || [];
            options.dosage = excelOptions.Dosage || [];
            options.timing = excelOptions.Timing || [];
            options.duration = excelOptions.Duration || [];

            // Refresh the investigation checklist.
            renderInvestigations();

            // Refresh existing treatment dropdowns while
            // preserving any values already selected.
            refreshTreatmentSelects();

            updatePreview();

            optionsStatus.textContent =
                'Excel options loaded successfully.';

            return true;

        } catch (error) {

            console.error('Could not load Excel options:', error);

            optionsStatus.textContent =
                `Could not load Excel options: ${error.message}`;

            return false;
        }
    }


    // =====================================
    // 5. INVESTIGATIONS
    // =====================================

    let investigationOptions = [];

    const selectedInvestigations = new Set();

    const investigationSearch =
        document.getElementById('investigation-search');

    const investigationList =
        document.getElementById('investigation-list');

    const selectedInvestigationList =
        document.getElementById('selected-investigation-list');


    function renderInvestigations() {

        const searchText =
            investigationSearch.value.trim().toLowerCase();

        investigationList.replaceChildren();

        const filteredOptions = investigationOptions.filter(test =>
            test.toLowerCase().includes(searchText)
        );

        if (filteredOptions.length === 0) {

            investigationList.appendChild(
                createElement(
                    'div',
                    'empty-selection',
                    'No matching investigations found.'
                )
            );

        }

        filteredOptions.forEach(test => {

            const label = createElement(
                'label',
                'investigation-option'
            );

            const checkbox = createElement('input');

            checkbox.type = 'checkbox';
            checkbox.checked =
                selectedInvestigations.has(test);

            const text = createElement('span', '', test);

            checkbox.addEventListener('change', () => {

                if (checkbox.checked) {
                    selectedInvestigations.add(test);
                } else {
                    selectedInvestigations.delete(test);
                }

                renderInvestigations();
                updatePreview();

            });

            label.appendChild(checkbox);
            label.appendChild(text);

            investigationList.appendChild(label);

        });


        // Selected investigation chips

        selectedInvestigationList.replaceChildren();

        if (selectedInvestigations.size === 0) {

            selectedInvestigationList.appendChild(
                createElement(
                    'span',
                    'empty-selection',
                    'No investigations selected.'
                )
            );

        }

        selectedInvestigations.forEach(test => {

            const chip = createElement(
                'div',
                'investigation-chip'
            );

            const name = createElement('span', '', test);

            const removeButton = createElement(
                'button',
                '',
                '×'
            );

            removeButton.type = 'button';
            removeButton.setAttribute(
                'aria-label',
                `Remove ${test}`
            );

            removeButton.addEventListener('click', () => {

                selectedInvestigations.delete(test);

                renderInvestigations();
                updatePreview();

            });

            chip.appendChild(name);
            chip.appendChild(removeButton);

            selectedInvestigationList.appendChild(chip);

        });

    }

    investigationSearch.addEventListener(
        'input',
        renderInvestigations
    );


    // =====================================
    // 6. DYNAMIC TREATMENT CARDS
    // =====================================

    const treatmentContainer =
        document.getElementById('treatment-fields');

    const addTreatmentButton =
        document.getElementById('add-treatment-button');

    let treatmentCounter = 0;


    function createTreatmentSelect(
        treatmentId,
        fieldName,
        labelText,
        optionValues
    ) {

        const field = createElement('div', 'field');

        const label = createElement(
            'label',
            '',
            labelText
        );

        if (fieldName === 'medicine') {

            const wrapper = createElement(
                'div',
                'medicine-autocomplete'
            );

            const input = createElement('input');

            input.type = 'text';
            input.id = `treatment-${treatmentId}-${fieldName}`;
            input.dataset.field = fieldName;
            input.placeholder = 'Type to search medicine...';
            input.autocomplete = 'off';

            const suggestions = createElement(
                'div',
                'medicine-suggestions'
            );

            suggestions.style.display = 'none';

            input._medicineOptions = optionValues;

            input._renderMedicineSuggestions = function () {

                const searchText = input.value.trim().toLowerCase();

                const matches = input._medicineOptions.filter(value =>
                    value.toLowerCase().includes(searchText)
                );

                suggestions.replaceChildren();

                if (matches.length === 0) {

                    const noResults = createElement(
                        'div',
                        'medicine-no-results',
                        'No matching medicines found'
                    );

                    suggestions.appendChild(noResults);

                } else {

                    matches.forEach(value => {

                        const item = createElement(
                            'div',
                            'medicine-suggestion',
                            value
                        );

                        item.addEventListener('mousedown', event => {

                            event.preventDefault();

                            input.value = value;

                            suggestions.style.display = 'none';

                            updatePreview();

                        });

                        suggestions.appendChild(item);

                    });

                }

                suggestions.style.display = 'block';

            };

            input.addEventListener('input', () => {
                input._renderMedicineSuggestions();
                updatePreview();
            });

            input.addEventListener('focus', () => {
                input._renderMedicineSuggestions();
            });

            input.addEventListener('blur', () => {
                suggestions.style.display = 'none';
            });

            wrapper.appendChild(input);
            wrapper.appendChild(suggestions);

            field.appendChild(label);
            field.appendChild(wrapper);

        } else {

            const select = createElement('select');

            select.id = `treatment-${treatmentId}-${fieldName}`;
            select.dataset.field = fieldName;

            const placeholder = createElement(
                'option',
                '',
                `Select ${labelText.toLowerCase()}`
            );

            placeholder.value = '';
            select.appendChild(placeholder);

            optionValues.forEach(value => {

                const option = createElement('option', '', value);

                option.value = value;

                select.appendChild(option);

            });

            select.addEventListener('change', updatePreview);

            field.appendChild(label);
            field.appendChild(select);

        }

        return field;

    }
    function refreshTreatmentSelects() {

        const cards =
            treatmentContainer.querySelectorAll('.treatment-card');

        cards.forEach(card => {

            const treatmentId = card.dataset.treatmentId;

            const fields = [
                { name: 'medicine', values: options.medicines },
                { name: 'dosage', values: options.dosage },
                { name: 'timing', values: options.timing },
                { name: 'duration', values: options.duration }
            ];

            fields.forEach(field => {

                const element = document.getElementById(
                    `treatment-${treatmentId}-${field.name}`
                );

                if (!element) return;

                const previousValue = element.value;

                if (field.name === 'medicine') {

                    element._medicineOptions = field.values;

                    if (element._renderMedicineSuggestions) {
                        element._renderMedicineSuggestions();
                    }

                } else {

                    element.replaceChildren();

                    const placeholder = createElement(
                        'option',
                        '',
                        `Select ${field.name === 'dosage'
                            ? 'dose / frequency'
                            : field.name}`
                    );

                    placeholder.value = '';
                    element.appendChild(placeholder);

                    field.values.forEach(value => {

                        const option = createElement('option', '', value);

                        option.value = value;

                        element.appendChild(option);

                    });

                    element.value = field.values.includes(previousValue)
                        ? previousValue
                        : '';

                }

            });

        });

    }

    function addTreatment() {

        treatmentCounter++;

        const id = treatmentCounter;

        const card = createElement(
            'div',
            'treatment-card'
        );

        card.dataset.treatmentId = id;


        // Card header

        const header = createElement(
            'div',
            'treatment-card-header'
        );

        const heading = createElement(
            'strong',
            '',
            `Treatment ${id}`
        );

        const removeButton = createElement(
            'button',
            'remove-treatment-button',
            'Remove'
        );

        removeButton.type = 'button';

        removeButton.addEventListener('click', () => {

            if (treatmentContainer.children.length <= 1) {

                alert('At least one treatment card is required.');

                return;

            }

            card.remove();

            renumberTreatments();
            updatePreview();

        });

        header.appendChild(heading);
        header.appendChild(removeButton);

        card.appendChild(header);


        // Four fields belonging to one treatment

        card.appendChild(
            createTreatmentSelect(
                id,
                'medicine',
                '1. Medicine / Treatment',
                options.medicines
            )
        );

        card.appendChild(
            createTreatmentSelect(
                id,
                'dosage',
                '2. Dose / Frequency',
                options.dosage
            )
        );

        card.appendChild(
            createTreatmentSelect(
                id,
                'timing',
                '3. Timing',
                options.timing
            )
        );

        card.appendChild(
            createTreatmentSelect(
                id,
                'duration',
                '4. Duration',
                options.duration
            )
        );

        treatmentContainer.appendChild(card);

        updatePreview();

    }


    function renumberTreatments() {

        const cards =
            treatmentContainer.querySelectorAll('.treatment-card');

        cards.forEach((card, index) => {

            const heading =
                card.querySelector('.treatment-card-header strong');

            heading.textContent = `Treatment ${index + 1}`;

        });

    }


    addTreatmentButton.addEventListener(
        'click',
        addTreatment
    );


    // =====================================
    // 7. COLLECT TREATMENT INFORMATION
    // =====================================

    function collectTreatments() {

        const cards =
            treatmentContainer.querySelectorAll('.treatment-card');

        return Array.from(cards).map(card => {

            const treatmentId = card.dataset.treatmentId;

            return {

                medicine: getValue(
                    `treatment-${treatmentId}-medicine`
                ),

                dosage: getValue(
                    `treatment-${treatmentId}-dosage`
                ),

                timing: getValue(
                    `treatment-${treatmentId}-timing`
                ),

                duration: getValue(
                    `treatment-${treatmentId}-duration`
                )

            };

        });

    }


    // =====================================
    // 8. UPDATE A4 PREVIEW
    // =====================================

    function updatePreview() {

        // Patient information

        setPreview('preview-mr', getValue('mr-number'));

        setPreview('preview-name', getValue('patient-name'));

        setPreview(
            'preview-date',
            formatDate(getValue('prescription-date'))
        );

        const age = getValue('patient-age');

        setPreview(
            'preview-age',
            age ? `${age} years` : ''
        );

        setPreview('preview-gender', getValue('patient-gender'));


        // Observations

        setPreview('preview-bp', getValue('bp'));

        setPreview('preview-pulse', getValue('pulse'));

        setPreview('preview-temp', getValue('temperature'));

        setPreview(
            'preview-observations-notes',
            getValue('observations-notes')
        );

        // Investigations

        document.getElementById('preview-investigations')
            .textContent = Array.from(selectedInvestigations).join('\n');


        // Follow-up

        setPreview('preview-followup', getValue('followup'));


        // Treatments

        const previewContainer =
            document.getElementById('preview-treatments');

        previewContainer.replaceChildren();

        const treatments = collectTreatments();

        let displayedNumber = 0;

        treatments.forEach(treatment => {

            const hasInformation = [
                treatment.medicine,
                treatment.dosage,
                treatment.timing,
                treatment.duration
            ].some(value => value);

            if (!hasInformation) return;

            displayedNumber++;

            const row = createElement('div', 'paper-treatment');

            const number = createElement(
                'span',
                'treatment-number',
                `${displayedNumber}.`
            );

            const details = createElement('div', 'treatment-details');

            // First line: medicine name followed by duration.
            const firstLine = createElement('div', 'treatment-first-line');

            if (treatment.medicine) {
                firstLine.appendChild(
                    createElement(
                        'span',
                        'treatment-medicine',
                        treatment.medicine
                    )
                );
            }

            if (treatment.duration) {
                firstLine.appendChild(
                    createElement(
                        'span',
                        'treatment-instructions',
                        treatment.duration
                    )
                );
            }

            if (treatment.duration || treatment.medicine) {
                details.appendChild(firstLine);
            }

            // Separate lines for dosage and timing.
            if (treatment.dosage) {
                details.appendChild(
                    createElement(
                        'div',
                        'treatment-instructions',
                        treatment.dosage
                    )
                );
            }

            if (treatment.timing) {
                details.appendChild(
                    createElement(
                        'div',
                        'treatment-instructions',
                        treatment.timing
                    )
                );
            }

            row.appendChild(number);
            row.appendChild(details);

            previewContainer.appendChild(row);

        });

    }


    // =====================================
    // 9. LIVE PREVIEW EVENTS
    // =====================================

    const form =
        document.getElementById('prescription-form');

    form.addEventListener('input', updatePreview);

    form.addEventListener('change', updatePreview);


    // =====================================
    // 10. CLEAR FORM
    // =====================================

    document.getElementById('reset-form')
        .addEventListener('click', () => {

            const confirmed = confirm(
                'Are you sure you want to clear all entered information?'
            );

            if (!confirmed) return;

            // Exit edit mode and prepare for a new prescription.
            editingPrescriptionId = null;
            prescriptionSavedForCurrentForm = false;

            form.reset();

            dateInput.value = getLocalDate();

            selectedInvestigations.clear();

            treatmentContainer.replaceChildren();

            treatmentCounter = 0;

            addTreatment();

            renderInvestigations();

            updatePreview();

        });

    // =====================================
    // 11. SAVE AND PRINT PRESCRIPTION
    // =====================================
    let editingPrescriptionId = null;
    let prescriptionSavedForCurrentForm = false;

    let printInProgress = false;

    // If the doctor changes any information, it becomes
    // a new prescription that needs to be saved.
    form.addEventListener('input', () => {
        prescriptionSavedForCurrentForm = false;
    });

    form.addEventListener('change', () => {
        prescriptionSavedForCurrentForm = false;
    });




    document.getElementById('print-button')
        .addEventListener('click', async () => {

            updatePreview();

            const patientName = getValue('patient-name');
            const mrNumber = getValue('mr-number');
            const prescriptionDate = getValue('prescription-date');

            // Validate required fields.
            if (!patientName || !prescriptionDate) {

                alert(
                    'Please enter the patient name and prescription date.'
                );

                return;
            }

            const printButton =
                document.getElementById('print-button');

            if (printButton.disabled) return;

            printButton.disabled = true;

            try {

                // Save only if this form has not already
                // been successfully saved.
                if (!prescriptionSavedForCurrentForm) {

                    const prescription = {

                        prescriptionId: editingPrescriptionId,

                        mrNumber: mrNumber,
                        patientName: patientName,
                        age: getValue('patient-age'),
                        gender: getValue('patient-gender'),
                        prescriptionDate: prescriptionDate,
                        bp: getValue('bp'),
                        pulse: getValue('pulse'),
                        temperature: getValue('temperature'),
                        observationsNotes: getValue('observations-notes'),
                        investigations: Array.from(selectedInvestigations),
                        treatments: collectTreatments(),
                        followup: getValue('followup')

                    };

                    const result =
                        await window.prescriptionDatabase.save(prescription);

                    if (!result.success) {

                        alert(
                            `Could not save prescription: ${result.message}\n\nPrinting has been cancelled.`
                        );

                        return;
                    }

                    prescriptionSavedForCurrentForm = true;

                    if (result.prescriptionId) {
                        editingPrescriptionId = result.prescriptionId;
                    }

                    // Display the generated or existing MR number.
                    document.getElementById('mr-number').value = result.mrNumber;

                    updatePreview();

                }

                // Open the A4 print dialogue through Electron.
                const printResult =
                    await window.prescriptionDatabase.print();

                if (!printResult.success) {

                    alert(
                        `Printing was cancelled or could not be completed.\n\n${printResult.message}`
                    );

                    return;

                }

                // Ask whether the prescription was printed successfully.
                const printedSuccessfully = confirm(
                    'Was the prescription printed successfully?'
                );

                if (printedSuccessfully) {

                    // Clear the form only after confirmation.
                    form.reset();

                    dateInput.value = getLocalDate();

                    selectedInvestigations.clear();

                    treatmentContainer.replaceChildren();

                    treatmentCounter = 0;

                    addTreatment();

                    renderInvestigations();

                    updatePreview();

                    prescriptionSavedForCurrentForm = false;

                    editingPrescriptionId = null;

                }

                // If the doctor selects No, retain the form.
                // The next print attempt will not save another copy.

            } catch (error) {

                printInProgress = false;

                console.error('Error saving prescription:', error);

                alert(
                    'An unexpected error occurred. Please try again.'
                );

            } finally {

                printButton.disabled = false;

            }

        });


    // =====================================
    // 12. UPDATE PREVIEW BUTTON
    // =====================================

    document.getElementById('preview-button')
        .addEventListener('click', () => {

            updatePreview();

            alert('Prescription preview updated.');

        });


    // =====================================
    // 13. SCALE A4 PREVIEW
    // =====================================

    function scalePreview() {

        const container =
            document.querySelector('.paper-container');

        const paper =
            document.getElementById('prescription-paper');

        if (!container || !paper) return;

        const availableWidth = container.clientWidth - 30;

        const scale = Math.min(
            1,
            availableWidth / paper.offsetWidth
        );

        paper.style.transform = `scale(${scale})`;

        container.style.height =
            `${paper.offsetHeight * scale + 30}px`;

    }

    window.addEventListener('resize', scalePreview);

    const resizeObserver = new ResizeObserver(scalePreview);

    resizeObserver.observe(
        document.querySelector('.preview-panel')
    );

    // =====================================
    // EXCEL WORKBOOK CONTROLS
    // =====================================

    document.getElementById('open-options-workbook')
        .addEventListener('click', async () => {

            const result =
                await window.prescriptionOptions.openWorkbook();

            if (!result.success) {

                alert(
                    `Could not open the Excel workbook: ${result.message}`
                );

            }

        });


    document.getElementById('reload-options')
        .addEventListener('click', async () => {

            const success = await loadExcelOptions();

            if (success) {

                alert('Excel options have been reloaded successfully.');

            } else {

                alert(
                    'Could not reload the Excel options. Please check the workbook.'
                );

            }

        });

    // =====================================
    // 14. INITIALISE APPLICATION
    // =====================================

    async function initialiseApplication() {

        // Load Dashboard statistics immediately on application startup.
        await loadDashboardStatistics();

        // Load options from the Excel workbook.
        await loadExcelOptions();

        // Initialise the prescription form.
        renderInvestigations();

        addTreatment();

        updatePreview();

        scalePreview();

    }

    initialiseApplication();

});
