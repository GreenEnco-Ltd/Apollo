const express = require("express");
const application = express();
const bodyparser = require("body-parser");
const cors = require("cors");
const cookieparser = require("cookie-parser");
const { connectToDatabase } = require("./utils");
const { default: axios } = require("axios");
const { projectsAndAPIS } = require("./Data/projects");
require("dotenv").config({ path: "./config.env" });
const schedule = require("node-schedule");

const allowedOrigins = [];

const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      console.log("Blocked Origin is ", origin);
      // callback(new Error("Not allowed by CORS"));
      console.log("Error: ", "Not allowed by CORS");
    }
  },
  credentials: true,
};

application.use(cors(corsOptions));
application.use(bodyparser.urlencoded({ extended: true }));
application.use(express.json());
application.use(cookieparser());

process.on("uncaughtException", (err) => {
  console.log("Server is closing due to uncaughtException occured!");
  console.log("Error :", err.message);
  server.close(() => {
    process.exit(1);
  });
});

const server = application.listen(process.env.PORT || 8010, () => {
  console.log("Server is running at port " + server.address().port);
});

process.on("unhandledRejection", (err) => {
  console.log("Server is closing due to unhandledRejection occured!");
  console.log("Error is:", err.message);
  server.close(() => {
    process.exit(1);
  });
});

async function testFunc() {
  try {
    const client = await connectToDatabase();
    const db = client.db("UKApolloArdexa2");
    await db.collection("test").insertOne({ sucess: true });
    console.log("data inserted into database");
  } catch (error) {
    console.log("Error ", error?.message);
  }
}

async function storeProjectsAndAPIS() {
  const client = await connectToDatabase();
  const db = client.db("UKApolloArdexa2");
  for (var i = 0; i < projectsAndAPIS.length; i++) {
    var project = projectsAndAPIS[i];
    await db.collection("projects").insertOne(project.projectDetail);
    for (var ii = 0; ii < project.APIS.length; ii++) {
      var api = project.APIS[ii];
      api = {
        projectID: project.projectDetail.projectID,
        ...api,
      };
      await db.collection("apis").insertOne(api);
    }
    console.log(project.APIS.length, " Data Inserted");
  }
  console.log("finished");
}

async function fetchData() {
  const client = await connectToDatabase();
  const db = client.db("UKApolloArdexa2");
  const projects = await db.collection("projects").find({}).toArray();
  const len = projects?.length || 0;
  for (let ii = 0; ii < len; ii++) {
    const project = projects[ii];
    const projectID = project?.projectID || "";
    const requiredData = project?.requiredData || {};

    const APIS = await db
      .collection("apis")
      .find({ projectID: project?.projectID })
      .toArray();
    const apisLen = APIS?.length || 0;
    for (let i = 0; i < apisLen; i++) {
      let endpoint,
        body = {},
        params = {},
        headers = {},
        method = "GET";
      const api = APIS[i];

      if (api?.endpoint?.call) {
        const functionKey = api.endpoint?.funcKey;
        const data = api?.endpoint?.data || {};
        const func = project["allFunctions"]?.[functionKey];
        if (func) {
          const newFunc = new Function("return " + func)();
          endpoint = newFunc({ ...requiredData, ...data });
        }
      } else endpoint = api?.endpoint?.data;
      if (api?.method?.call) {
        const functionKey = api.method?.funcKey;
        const data = api?.method?.data || {};
        const func = project["allFunctions"]?.[functionKey];
        if (func) {
          const newFunc = new Function("return " + func)();
          method = newFunc({ ...requiredData, ...data });
        }
      } else method = api?.method?.data || "GET";

      if (api?.body?.call) {
        const functionKey = api.body?.funcKey;
        const data = api?.body?.data || {};
        const func = project["allFunctions"]?.[functionKey];
        if (func) {
          const newFunc = new Function("return " + func)();
          body = newFunc({ ...requiredData, ...data });
        }
      } else body = api?.body?.data || {};

      if (api?.params?.call) {
        const functionKey = api.params?.funcKey;
        const data = api?.params?.data || {};
        const func = project["allFunctions"]?.[functionKey];
        if (func) {
          const newFunc = new Function("return " + func)();
          params = newFunc({ ...requiredData, ...data });
        }
      } else params = api?.params?.data || {};

      if (api?.headers?.call) {
        const functionKey = api.headers?.funcKey;
        const data = api?.headers?.data || {};
        const func = project["allFunctions"]?.[functionKey];
        if (func) {
          const newFunc = new Function("return " + func)();
          headers = newFunc({ ...requiredData, ...data });
        }
      } else headers = api?.headers?.data || {};
      try {
        const axiosInstance = axios.create({
          baseURL: project?.baseURL + endpoint,
          method: method,
          headers: headers,
          params: params,
          data: body,
        });

        const { data } = await axiosInstance.request();

        const datas = data?.[`${api?.dataKey}`] || [];
        var final_collection = projectID + "_" + (api?.rawDataCollection || "");
        var logDetail = {
          fetchingData: api?.rawDataCollection?.replace("raw_data_", ""),
          projectID: projectID,
        };
        if (api?.rawDataCollection && datas?.length > 0) {
          await db.collection(final_collection).insertMany(datas);
        }
        if (data?.length > 10000) {
          await db
            .collection(final_collection + "_document_exceed_logs")
            .insertOne({
              ...logDetail,
              DateTime: new Date().toLocaleString(),
              insertDataLength: datas?.length,
              sucess: false,
            });
        }

        await db.collection(final_collection + "_sucess_logs").insertOne({
          ...logDetail,
          DateTime: new Date().toLocaleString(),
          insertDataLength: datas?.length,
          sucess: true,
        });
        // const transformFunc =
        //   project?.allFunctions?.[api?.transformFunc?.funcKey];
        // const newFunc = new Function("return " + transformFunc)();
        // const transformedData =
        //   newFunc(datas, api?.transformFunc?.data || {}) || [];
        // if (api?.transformedDataCollection && transformedData?.length > 0) {
        //   await db
        //     .collection(api?.transformedDataCollection)
        //     .insertMany(transformedData);
        //   console.log("transformed inserted");
        // }
      } catch (error) {
        await db.collection(final_collection + "_error_logs").insertOne({
          ...logDetail,
          DateTime: new Date().toLocaleString(),
          error: error?.message || "Error Not Found",
          sucess: false,
        });
      }
    }
  }

  console.log("Job finished at ",new Date().toUTCString()," ",new Date().toLocaleString())

}

const job3 = schedule.scheduleJob("0 0 22 * * *", function () {
  console.log("Job started at ",new Date().toUTCString()," ",new Date().toLocaleString())
  fetchData();
});

testFunc();
// storeProject()
// storeAPI("UKApolloArdexa",APIS)

// storeProjectsAndAPIS();
