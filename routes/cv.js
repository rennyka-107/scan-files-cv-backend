var express = require("express");
var router = express.Router();
const textract = require("textract");
const fs = require("fs");
const path = require("path");
// const Tesseract = require("tesseract.js");
const client = require("../services/elasticsearch");
const { unlink } = require("fs/promises");

/* GET users listing. */
router.get("/", async function (req, res, next) {
  const result = await client.search({
    index: "cvs",
    query: {
      match: { content: "" },
    },
  });
  res.json({
    status: result?.hits?.hits?.length > 0,
    result: result?.hits?.hits.map((item) => ({
      ...item._source,
      id: item._id,
    })),
  });
});

router.get("/:keyword", async function (req, res, next) {
  try {
    const { page, size } = req.query;
    if (!page || !size) {
      return res.status(400).json({
        status: false,
        message: "Page and size required!",
      });
    }
    const result = await client.search({
      index: "cvs",
      from: (page - 1) * size,
      size: size,
      sort: [
        {
          createdAt: {
            unmapped_type: "date",
          },
        },
      ],
      query:
        req.params.keyword === "all"
          ? {
              match_all: {},
            }
          : {
              match: {
                content: { query: req.params.keyword, operator: "and" },
              },
            },
    });

    return res.json({
      status: result?.hits?.hits?.length > 0,
      result: result?.hits?.hits.map((item) => ({
        ...item._source,
        id: item._id,
      })),
    });
  } catch (err) {
    console.log(err);
    res.json({
      status: false,
      message: "An error happened!",
    });
  }
});

router.post("/run-job-scan", async function (req, res, next) {
  await client.indices.create({
    index: "cvs",
  });
  const pathFolder = "public/cvs";
  const readFiles = fs.readdirSync(pathFolder);
  readFiles.forEach(async function (file, index) {
    const fromPath = path.join(pathFolder, file);
    const statResult = fs.statSync(fromPath);
    if (statResult.isFile()) {
      const { fileTypeFromFile } = await import("file-type");
      const { ext } = await fileTypeFromFile(fromPath);
      switch (ext) {
        case "docx":
          textract.fromFileWithPath(fromPath, async function (error, text) {
            await client.index({
              index: "cvs",
              document: {
                path: `cvs/${file}`,
                content: text,
                createdAt: new Date(),
              },
            });
            fs.writeFile(`public/txt/${file}.txt`, text, function (err) {
              if (err) {
                return console.log(err);
              }
            });
            if (index === readFiles.length - 1) {
              console.log(
                index,
                readFiles.length - 1,
                index === readFiles.length - 1,
                "docx"
              );
              res.json({
                status: true,
                message: "Successful add index query",
              });
            }
          });
          break;
        case "pdf":
          textract.fromFileWithPath(fromPath, async function (error, text) {
            await client.index({
              index: "cvs",
              document: {
                path: `cvs/${file}`,
                content: text,
                createdAt: new Date(),
              },
            });
            fs.writeFile(`public/txt/${file}.txt`, text, function (err) {
              if (err) {
                return console.log(err);
              }
            });
            if (index === readFiles.length - 1) {
              console.log(
                index,
                readFiles.length - 1,
                index === readFiles.length - 1,
                "pdf"
              );
              res.json({
                status: true,
                message: "Successful add index query",
              });
            }
          });
          break;
        default:
          break;
      }
    }
  });
  // res.json({
  //   status: true,
  //   message: "Successful add index query",
  // });
});

router.delete("/delete-index/:index", async function (req, res, next) {
  client.indices
    .delete({
      index: req.params.index,
    })
    .then(
      async function (resp) {
        const pathFolder = "public/txt";
        await fs.readdir(pathFolder, function (err, files) {
          if (err) {
            console.error("Could not list the directory.", err);
            process.exit(1);
          }

          files.forEach(async function (file, index) {
            const fromPath = path.join(pathFolder, file);
            await unlink(fromPath);
          });
        });
        return res.json({
          status: true,
          message: "Successful delete query!",
        });
      },
      function (err) {
        console.trace(err.message);
        res.json({
          status: false,
          message: err.message,
        });
      }
    );
});

router.post("/seed/:numberRecord", async function (req, res, next) {
  const dataSeed = [];
  for (let i = 1; i <= req.params.numberRecord; i++) {
    dataSeed.push({
      path: `cvs/path-minh-${i}`,
      content: `content-${i} Minh`,
      createdAt: new Date(),
    });
  }
  const body = dataSeed.flatMap((doc) => [{ index: { _index: "cvs" } }, doc]);
  await client.bulk({ refresh: true, body });
  res.json({
    status: true,
    message: `Successful insert ${req.params.numberRecord} record`,
  });
});

router.get("/files-cv/get-files-scanned", async function (req, res, next) {
  try {
    const pathFolderTxt = "public/txt";
    const pathFolderCvs = "public/cvs";
    const filesScanned = fs.readdirSync(pathFolderTxt);
    const filesTotal = fs.readdirSync(pathFolderCvs);
    res.json({
      status: true,
      scanned: filesScanned.length,
      remaining: filesTotal.length - filesScanned.length,
    });
  } catch (err) {
    res.json({
      status: false,
      message: "An error happned!",
    });
  }
});

module.exports = router;
