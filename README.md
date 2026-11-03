# Prescription Manager

A Windows desktop application developed using Electron for creating, managing and printing doctor prescriptions.

The application provides a simple interface for doctors to enter patient details, record observations, select investigations and prescribe medicines. Prescriptions are formatted for A4 printing using a layout based on the provided prescription template.

The application allows doctors to:

- Enter patient details, including MR number, name, age, gender and date.
- Record patient observations, including blood pressure, pulse and temperature.
- Select investigations from a predefined list.
- Search for medicines by name using a searchable dropdown.
- Select medicine dosage, timing and duration.
- Create and print prescriptions using an A4 layout.
- Save prescriptions for future reference.
- View, edit and delete previously saved prescriptions.
- Manage the available medicine and investigation options through an Excel workbook.

## Technologies

The application is built using:

- Electron
- Electron Builder
- HTML
- CSS
- JavaScript
- SQLite
- better-sqlite3
- xlsx (SheetJS)

The application uses Electron's main and renderer processes, with IPC communication for operations requiring access to local resources.

## Requirements

For development, you need:

- Node.js
- npm
- Git (optional, for version control)

The application uses a local SQLite database and does not require a separate database server.

## Application Data

The application uses the following files:

**Database:** `Prescription_Manager.db`

The SQLite database stores prescription records and other application data.

**Excel workbook:** `Prescription_Options.xlsx`

The Excel workbook contains the predefined options used in the application.

It contains the following worksheets:

- Medicines
- Investigations
- Dosage
- Timing
- Duration

These lists can be updated by editing the Excel workbook. The application uses the updated options when creating prescriptions.

Application data is stored locally in the user's application data directory. It is separate from the installed application files.

## Running the Application in Development

- Clone or download the repository.
- Open a terminal in the project folder (the folder containing `package.json`).
- Install the dependencies:

```bash
npm install
```

- Start the application:

```bash
npm start
```

The application will launch as an Electron desktop application.

## Packaging the Application

To create a packaged Windows application without creating an installer, run:

```bash
npx electron-builder --win dir
```

The packaged application will be generated inside the `dist` directory.

## Creating the Windows Installer

The project uses Electron Builder with the NSIS Windows installer.

To generate the Windows installer, run:

```bash
npm run build
```

The installer will be generated inside the `dist` directory.

The output will be a Windows installer file similar to:

```text
Prescription Manager Setup 1.0.0.exe
```

This is the file that should be provided to the client for installation.

## Installing the Application on the Client Computer

- Transfer the Windows installer (`Setup.exe`) to the client's computer.
- Run the installer.
- Follow the installation instructions.
- Launch Prescription Manager from the Windows Start Menu or desktop shortcut, if created.

No MySQL server, XAMPP installation or internet connection is required for normal application use.

The application stores its database and editable options locally on the computer.

**Important:** The application's local database and Excel options are stored separately from the installed application files. They should be preserved when updating the application.

## Updating the Application

When a new version is developed:

- Update the application version in `package.json`.
- Test the changes in development.
- Generate a new Windows installer:

```bash
npm run build
```

- Provide the new installer to the client.
- Install the updated version.

Before distributing an update, verify that existing prescription records and customised Excel options remain available.

## Version Control

Git is used for version control.

To upload changes to GitHub:

```bash
git add .
git commit -m "Describe your changes"
git push
```
