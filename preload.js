const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appInfo', {
    name: 'Prescription Manager',
    version: '1.0.0'
});


// =====================================
// EXCEL OPTIONS
// =====================================

contextBridge.exposeInMainWorld('prescriptionOptions', {

    load: () => ipcRenderer.invoke('options:load'),

    openWorkbook: () => ipcRenderer.invoke('options:open-workbook')

});

// =====================================
// PRESCRIPTION DATABASE
// =====================================

contextBridge.exposeInMainWorld('prescriptionDatabase', {

    save: (prescription) =>
        ipcRenderer.invoke('prescription:save', prescription),

    getHistory: () =>
        ipcRenderer.invoke('prescription:history'),

    getPatients: () =>
        ipcRenderer.invoke('patients:list'),

    delete: (prescriptionId) =>
        ipcRenderer.invoke('prescription:delete', prescriptionId),

    getDashboardStatistics: () =>
    ipcRenderer.invoke('dashboard:statistics'),

});