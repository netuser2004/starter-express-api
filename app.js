import fs from 'fs';
import es from 'event-stream';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import csv from 'csv-parser'
import { fileURLToPath } from 'url';
import { create, insert, search } from "@lyrasearch/lyra";
import { persistToFile, restoreFromFile } from "@lyrasearch/plugin-data-persistence";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filename = path.join(__dirname, '/data/cities.msp');
const PORT = 3000;
// let cityDB = null;
let isReady = false;

const app = express();
app.disable('x-powered-by');
app.set('etag', false);
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5501',
    'http://localhost:8100'
  ],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}));

app.all('/', async (req, res) => {
  const term = req.query.term;
  if (term && isReady) {
      const searchResult = await search(cityDB, {
        term: term,
        properties: ["name"],
        limit: 25,
      });
      res.send(searchResult.hits);
  } else {
      res.send('Yo!');
  }
})

const cityDB = await create({
  schema: {
    name: "string",
    district: "string",
    state: "string",
    country: "string",
    latitude: "string",
    longitude: "string",
    timezone: "string",
    population: "string",
  },
});

function readFile() {
  let lineNumber = 0;
  let cities = [];
  fs.createReadStream('cities2.txt')
    .pipe(csv({ separator: '\t' }, [
      'name',
      'district',
      'state',
      'country',
      'latitude',
      'longitude',
      'timezone',
      'population'
    ]))
    .on('data', async (data) => {
      // await insert(cityDB, data);
      cities.push(data);
      lineNumber++;
      if (lineNumber % 1000000 === 0) {
        console.log(lineNumber, data);
      }
      if (lineNumber % 500 === 0) {
        await insertBatch(cityDB, cities, { batchSize: 500 });
        cities = [];
      }
    })
    .on('end', async () => {
        await insertBatch(cityDB, cities, { batchSize: 500 });
        console.log('uploaded all data !!!');
        // persistToFile(cityDB, 'binary', filename);
        // isReady = true;
        app.listen(PORT, () => {
          console.log(`Server running on port ${PORT}`);
        });
    });
}

function processFile(citiesFile = 'cities2.txt', startFrom = 2, stopAt = null) {
  return new Promise(async (resolve, reject) => {
    if (fs.existsSync(path)) {
      cityDB = restoreFromFile('binary', filename);
      console.log('restored instance');
      isReady = true;
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    }

    const BATCH_SIZE = 10;
    const fieldSepartor = '\t';
    let items = [];
    let lineNumber = 0;
    const s = fs.createReadStream(citiesFile)
      .pipe(es.split())
      .pipe(es.mapSync(async function (line) {
          s.pause();
          lineNumber++;
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
            const city = {name, district, state, country, latitude, longitude, timezone, population};
            await insert(cityDB, city);
            if (lineNumber % 1000000 === 0) {
              console.log(lineNumber);
            }
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
          .on('end', async function () {
            persistToFile(cityDB, 'binary', filename);
            isReady = true;
            app.listen(PORT, () => {
              console.log(`Server running on port ${PORT}`);
            });
            resolve();
          })
      );
  });
}

processFile();