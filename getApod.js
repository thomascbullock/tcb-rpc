const MediaObject = require('./mediaObject');
const axios = require('axios');

exports.getApod = async function(){

    //get APOD payload from NASA
    const nasaResponse = await axios.get('https://api.nasa.gov/planetary/apod\?api_key\=4daOLYTIsZBadmz1Y1OTILDyGAgxk7LX6sqDczBc\&count\=1');
    const nasaData = nasaResponse.data[0];
    
    const nasaFileName = new URL(nasaResponse.data[0].hdurl).pathname.split('/').pop();

    //get APOD image from NASA
    const nasaImgResponse = await axios.get(nasaResponse.data[0].hdurl, {
    responseType: 'arraybuffer'
  });

    const nasaImgBuffer = Buffer.from(nasaImgResponse.data);

    const nasaMediaObject = new MediaObject({name: nasaFileName, type: 'jpg', bits: nasaImgBuffer});

    const nasaSavedObject = await nasaMediaObject.save();

    console.log(nasaSavedObject);

    const returnArr = [{
        date: nasaData.date,
        explanation: nasaData.explanation,
        hdurl: `https://thomascbullock.com${nasaSavedObject.url}`,
        media_type: 'image',
        service_version: 'v1',
        title: nasaData.title,
        url: `https://thomascbullock.com${nasaSavedObject.url}`
    }]

    return returnArr;

}