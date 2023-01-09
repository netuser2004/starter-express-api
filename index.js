const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const { Index } = require('flexsearch');
const AdmZip = require("adm-zip");

const PORT = 3000;
let cities = [];
const index = new Index("performance");
let isReady = false;

const app = express();
app.disable('x-powered-by');
app.set('etag', false);
app.use(helmet());
app.use(cors({
    origin: [
      'http://localhost:5501',
    ],
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  }));

// app.use('static', express.static(path.join(__dirname, 'static')));

app.all('/', (req, res) => {
    const term = req.query.term;
    if (term && isReady) {
        const items = index.search(term);
        const result = items.map((item) => cities[item]);
        const exact = result.filter((item) => item.name.toLowerCase() === term.toLowerCase());
        const nonExact = result.filter((item) => item.name.toLowerCase() !== term.toLowerCase());
        // result.sort((a,b) => b.population - a.population)
        const final = [...exact.sort((a, b) => b.population - a.population), ...nonExact.sort((a, b) => b.population - a.population)];
        res.send(final);
    } else {
        res.send('Yo!');
    }
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;

const startTime = new Date().getTime();
const zip = new AdmZip(path.join(__dirname, 'citiesDb.zip'));
const zipEntries = zip.getEntries();
let count = 0;
zipEntries.forEach(function (zipEntry) {
    const list = JSON.parse(zipEntry.getData().toString("utf8"));
    const start = cities.length + 1;
    list.forEach((city, i) => {
        index.add(i + start, city.name);
    });
    cities = [...cities, ...list];
    count++;
    console.log(`${count} of ${zipEntries.length}`);
});
const timeTaken = (new Date().getTime() - startTime) / 1000;
console.log(`Complete. Time Taken: ${timeTaken}seconds.`, cities.length);
isReady = true;

