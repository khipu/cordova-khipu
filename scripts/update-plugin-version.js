const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// Rutas de los archivos
const packageJsonPath = path.resolve(__dirname, '../package.json');
const pluginXmlPath = path.resolve(__dirname, '../plugin.xml');

// Leer la versión de package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const newVersion = packageJson.version;

// Actualizar plugin.xml
fs.readFile(pluginXmlPath, 'utf-8', (err, data) => {
    if (err) throw err;

    xml2js.parseString(data, (err, result) => {
        if (err) throw err;

        // Actualizar la versión en plugin.xml
        result.plugin.$.version = newVersion;

        // Convertir de nuevo a XML
        const builder = new xml2js.Builder();
        const updatedXml = builder.buildObject(result);

        // Guardar los cambios en plugin.xml
        fs.writeFile(pluginXmlPath, updatedXml, 'utf-8', (err) => {
            if (err) throw err;
            console.log(`plugin.xml version updated to ${newVersion}`);
        });
    });
});
