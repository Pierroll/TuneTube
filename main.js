const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const server = require('./server');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadURL('http://localhost:3002'); // Asegúrate de que este es el mismo puerto que en server.js

    ipcMain.handle('open-dialog', async () => {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Guardar archivo como',
            defaultPath: 'downloaded_file.mp3',
            filters: [{ name: 'MP3', extensions: ['mp3'] }],
        });

        return filePath;
    });

    ipcMain.on('download-progress', (event, progress) => {
        mainWindow.webContents.send('download-progress', progress);
    });

    ipcMain.on('download-complete', (event, result) => {
        mainWindow.webContents.send('download-complete', result);
    });
}

app.on('ready', () => {
    server.listen(3002, () => {
        console.log('Server is running on http://localhost:3002');
        createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

process.on('SIGINT', () => {
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
