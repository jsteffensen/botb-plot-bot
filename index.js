const fsp = require('fs').promises;
const puppeteer = require('puppeteer');

// state variables
let config;
let coords;

(async () => {

    // load username, password, selected prize etc. from config.json
	config = await getConfig();
	
	// load coordinates from .csv file
	coords = await getCoords();

    const browser = await puppeteer.launch({headless:false});

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1100 });

    console.log('Go to login');
    await page.goto('https://www.botb.com/login', { waitUntil: 'networkidle0' });
    await delay(2000);

    // clear popup special deal by clicking page margin
	await delay(3000);
	await page.mouse.click(5, 200);
	await delay(1000);
	
	await login(page);

    await addPrizeToCart(page, config.prizeURL);

    await goToCompetition(page);
	await setupGame(page);

	// iterate over the coordinates until empty
	while(coords.length > 0) {
		await playCoord(page, coords.shift());	
	}
    
    console.log('complete');
    //await browser.close();
})();

async function getConfig() {
	
	let readConfig = await fsp.readFile('./config.json', 'utf8');
	return JSON.parse(readConfig);
}

async function getCoords() {	
	let readCoords = await fsp.readFile('./coords.csv', 'utf8');
	let coordsObj = [];
	let coordsArray = readCoords.split(/\r?\n/);
	
	for(let i=0; i<coordsArray.length; i++) {
		if(coordsArray[i].indexOf(',')>-1) {
			let xVal = parseInt(coordsArray[i].split(',')[0]);
			let yVal = parseInt(coordsArray[i].split(',')[1]);
			coordsObj.push({"zx": xVal, "zy": yVal});
		}
	}

	return coordsObj
}

async function login(page) {

    let inputEmail = await page.$("input#Email");
    let inputPassword = await page.$("input#Password");
	let buttonSubmit = await page.$("button.login-submit-button");

	inputEmail.focus();
	await delay(300);
	await page.keyboard.type(config.email);
	
	await delay(300);
	
	inputPassword.focus();
	await delay(300);
	await page.keyboard.type(config.password);
	
	await delay(300);
	
	await buttonSubmit.click();
	await delay(3000);
}

async function addPrizeToCart(page, prizeURL) {

    console.log('Go to ' + prizeURL);
    await page.goto(prizeURL, { waitUntil: 'networkidle0' });
    await delay(1000);

    // clear popup special deal by clicking page margin
	await page.mouse.click(5, 200);
	
    console.log('Enter now');
    await page.evaluate(() => {
        document.querySelector('a.enter-now-button').click();
    });
    await delay(1500);

    console.log('Add to basket');
    await page.evaluate(() => {
        document.querySelector('a.add-to-basket').click();
    });
    await delay(3000);
}

async function goToCompetition(page) {

    console.log('Proceed to competition');

    await page.evaluate(() => {
        document.querySelector('a.proceed').click();
    });

    // long wait to load competition
    await delay(4000);

    // clear popup by clicking page margin
    await page.mouse.click(5, 200);
    await delay(1000);

}

async function setupGame(page) {
	await page.evaluate(()=> {
		botb['spotTheBall']['ui'].centerLensOnCompPic();
		botb['spotTheBall']['ui'].suppressCoordMovementValidation();
	});
}

async function playCoord(page, args) {
    
	console.log(args);
	
	await page.evaluate(({args}) => {
		console.log(args);
		botb['spotTheBall']['ui'].playTicketHandler(args);
	},{args});
	
	await delay(1000);
}

// convenience functions

// https://scrapingant.com/blog/puppeteer-post-put-delete-request
async function gotoExtended(page, request) {
    const { url, method, headers, postData } = request;

    // get tickets
    if (method == 'GET') {
        let wasCalled = false;
        await page.setRequestInterception(true);

        const interceptRequestHandler = async (request) => {
            try {
                if (wasCalled) {
                    return await request.continue();
                }

                wasCalled = true;
                const requestParams = {};

                if (method) requestParams.method = method;
                await request.continue(requestParams);


            } catch (error) {
                console.log('Error while request interception', { error });
            }
        };
        await page.on('request', interceptRequestHandler);
        return page.goto(url);
    }


}

function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time)
    });
}