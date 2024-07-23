const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { ipcMain } = require('electron');

const server = express();
const PORT = process.env.PORT || 3002;

server.set('view engine', 'ejs');
server.set('views', path.join(__dirname, 'views'));
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use(express.static(path.join(__dirname, 'public')));

server.get('/', (req, res) => {
  res.render('index');
});

const isValidYoutubeURL = (url) => {
  const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
  return regex.test(url);
};

server.post('/convert', async (req, res) => {
  const { youtubeURL, filePath } = req.body;

  console.log('Recibido:', youtubeURL);

  if (!isValidYoutubeURL(youtubeURL)) {
    console.log('URL no válida:', youtubeURL);
    return res.json({ success: false, message: 'URL de YouTube no válida' });
  }

  if (!filePath) {
    return res.json({ success: false, message: 'La descarga fue cancelada.' });
  }

  try {
    console.log('Iniciando conversión...');
    const ytDlpPath = path.join(__dirname, 'bin', 'yt-dlp.exe');
    const ytDlp = spawn(ytDlpPath, ['-x', '--audio-format', 'mp3', '--output', filePath, '--no-playlist', youtubeURL]);

    ytDlp.stdout.on('data', (data) => {
      const output = data.toString();
      const progressMatch = output.match(/(\d+\.\d+)%/);
      if (progressMatch) {
        const progress = parseFloat(progressMatch[1]);
        ipcMain.emit('download-progress', null, progress); // Emitimos el evento a Electron
      }
      console.log(`stdout: ${output}`);
    });

    ytDlp.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    ytDlp.on('close', (code) => {
      console.log('Proceso cerrado con código:', code);
      if (code === 0) {
        ipcMain.emit('download-complete', null, { success: true, message: 'El archivo se ha descargado y guardado correctamente.' }); // Emitimos el evento a Electron
        res.json({ success: true, message: 'El archivo se ha descargado y guardado correctamente.', filePath: filePath });
      } else {
        ipcMain.emit('download-complete', null, { success: false, message: 'Error al procesar el vídeo' }); // Emitimos el evento a Electron
        res.status(500).json({ success: false, message: 'Error al procesar el vídeo' });
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al procesar el vídeo' });
  }
});

server.post('/delete', async (req, res) => {
  const { filePath } = req.body;

  try {
    await fs.promises.unlink(filePath);
    res.json({ success: true, message: 'Archivo eliminado correctamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al eliminar el archivo.' });
  }
});

module.exports = server;
