const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const middlewareFunction = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const hasPassword = await bcrypt.hash(password, 10);
  const getQuery = `select * from user where username ='${username}';`;
  const username_data = await db.get(getQuery);
  if (username_data === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passCompare = await bcrypt.compare(password, username_data.password);
    if (passCompare === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const convertDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};
app.get("/states/", middlewareFunction, async (request, response) => {
  const getStates = `select * from state;`;
  const dbGet = await db.all(getStates);
  response.send(dbGet.map((eachI) => convertDbObjectToResponseObject(eachI)));
});

app.get("/states/:stateId/", middlewareFunction, async (request, response) => {
  const { stateId } = request.params;
  const getStates = `SELECT * FROM state WHERE
    state_id = ${stateId};`;
  const state_some = await db.get(getStates);
  response.send(convertDbObjectToResponseObject(state_some));
});

app.post("/districts/", middlewareFunction, async (request, response) => {
  const body_rt = request.body;
  const { districtName, stateId, cases, cured, active, deaths } = body_rt;
  const insertData = `insert into district (district_name,state_id,cases,cured,active, deaths)
  values('${districtName}',${stateId}, ${cases},${cured},${active},${deaths});`;

  const val = await db.run(insertData);
  const district_id = val.lastID;
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  middlewareFunction,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrict = `select  district_id as districtId, district_name as districtName ,
 state_id as stateId , cases , cured,active,deaths from district where district_id = ${districtId}; `;
    const get_val = await db.get(getDistrict);
    response.send(get_val);
  }
);

app.delete(
  "/districts/:districtId/",
  middlewareFunction,
  async (request, response) => {
    const { districtId } = request.params;
    const del = `delete from district where district_id = ${districtId};`;
    await db.run(del);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  middlewareFunction,
  async (request, response) => {
    const { districtId } = request.params;
    const dis = request.body;
    const { districtName, stateId, cases, cured, active, deaths } = dis;

    const updateDis = `update district set 
  district_name ='${districtName}',
  state_id = ${stateId},
  cases = ${cases},
  cured = ${cured},
  active = ${active},
  deaths = ${deaths} where district_id = ${districtId};`;
    await db.run(updateDis);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  middlewareFunction,
  async (request, response) => {
    const { stateId } = request.params;
    const getSumOfSates = `select sum(cases) as totalCases ,sum(cured) as totalCured, sum(active) as totalActive,
    sum(deaths) as totalDeaths from district where state_id = ${stateId}; `;
    const sum_of_val = await db.get(getSumOfSates);
    response.send(sum_of_val);
  }
);

module.exports = app;
