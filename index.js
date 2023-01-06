const fs = require('fs');
const es = require('event-stream');
const { Index } = require('flexsearch');
const cities = [];
const express = require('express');
const index = new Index("performance");

const app = express()
app.all('/', (req, res) => {
    const term = req.query.term;
    if (term) {
        const items = index.search(term);
        const result = items.map((item) => cities[item]);
        const exact = result.filter(item => item.name.toLowerCase() === term.toLowerCase());
        const nonExact = result.filter(item => item.name.toLowerCase() !== term.toLowerCase());
        // result.sort((a,b) => b.population - a.population)
        const final = [...exact.sort((a,b) => b.population - a.population), ...nonExact.sort((a,b) => b.population - a.population)];
        res.send(final);
    } else {
        res.send('Yo!');
    }
})

function processFile(inputFile, startFrom = 1, stopAt = null) {
    return new Promise(async (resolve, reject) => {
        const fieldSepartor = '\t';
        let lineNumber = 0;
        const s = fs.createReadStream(inputFile)
        .pipe(es.split())
        .pipe(es.mapSync(function (line) {
            s.pause();
            lineNumber++;
            // if (lineNumber % 1000000 === 0) console.log(lineNumber);
            if (lineNumber >= startFrom) {
                const [
                name,
                district,
                state,
                country,
                latitude,
                longitude,
                timezone,
                population
                ] = line.split(fieldSepartor);
                index.add(lineNumber - 1, name);
                cities.push({name, district, state, country, latitude: +latitude, longitude: +longitude, timezone, population: +population});
            }

            if (stopAt && lineNumber >= stopAt) {
                s.end();
            }

            s.resume();
            })
            .on('error', function (err) {
                console.log('Error while reading file.', err);
                reject(err);
            })
            .on('end', function () {
                console.log('Read entire file.');
                resolve();
            })
        );
    });
}

processFile('cities2.txt', 1, null)
  .then(() => {
    app.listen(process.env.PORT || 3000);
    console.log('listening on port 3000');
  })
  .catch(err => console.err(err));
