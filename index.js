const textToImage = require("text-to-image");
const childProcess = require("child_process");
const pngFileStream = require("png-file-stream");
const GIFEncoder = require("gifencoder");
const fs = require("fs");
const koa = require("koa");
const koaRouter = require("koa-router");
const send = require("koa-send");

const server = new koa();
const router = koaRouter();

function getGif(shortcut, full){

    const currentDirectory = __dirname;
    const tempDir = `${currentDirectory}/tmp`;
    if (!fs.existsSync(tempDir)){
        fs.mkdirSync(tempDir);
    }
    let width = 400;
    let height = 20;

    const options = {
        maxWidth: width,
        fontSize: height*0.8,
        lineHeight: height,
        margin: 10,
        bgColor: "#000000",
        textColor: "#FFFFFF"
    };

    const input = {
        shortcut: shortcut,
        full: full
    }

    const promises = [];
    let lastdata;
    function createFrame(message){
        const frameIndex = promises.length;
        lastdata = message;
        promises.push(textToImage.generate(message, options).then((data) => {
            data = data.replace(/^data:image\/png;base64,/, "");
            const fileLocation = `${tempDir}/${1000 + frameIndex}.png`;
            fs.writeFileSync(fileLocation, data, "base64");
        }));
    }
    function pause(frames){
        let i = frames;
        while(i--){
            createFrame(lastdata);
        }
    }

    input.shortcut.concat("   ")
    input.shortcut.split("").reduce((partialMessage, letter, index) => {
        let currentMessage = partialMessage + letter;
        createFrame(`${currentMessage}▊`);
        return currentMessage;
    }, "");
    pause(2);

    createFrame(`${input.full}▊`);
    pause(30);

    const encoder = new GIFEncoder(width, height + 2* options.margin);
    return Promise.all(promises).then(() =>{
        const fileLocation = `${tempDir}/result.gif`;

        const writeStream = fs.createWriteStream(fileLocation);

        pngFileStream(`${tempDir}/*.png`)
        .pipe(encoder.createWriteStream({repeat: 0, delay: 100}))
        .pipe(writeStream);
        // childProcess.exec(`open -a "Google Chrome" ${fileLocation}`);
        return writeStream;
    });
}

router.get("/replace.gif", async function(ctx, next){
    const writeStream = await getGif(decodeURIComponent(ctx.request.query.abbr), decodeURIComponent(ctx.request.query.full));
    await new Promise(function(res, rej){
        writeStream.on("finish", async function(){
            res("tmp/result.gif");
        });
    })
    await send(ctx, "tmp/result.gif");
});

server.use(router.routes());
server.use(router.allowedMethods());
server.listen(3000, function(){
   console.log("App available on:")
   console.log("http://localhost:3000/replace"); 
});