/**
 * Implementation of metaWeblog.newMediaObject method
 * With enhanced image processing capabilities
 */
const auth = require('./auth').auth;
const authError = require('./auth').authError;
const MediaObject = require('./mediaObject');

exports.newMediaObject = async function(params) {
  try {
    // Authenticate user
    if (!auth(params)) {
      return authError();
    }

    // Extract media parameters
    const mediaObjParams = {
      name: params[3].name,
      bits: params[3].bits,
      type: params[3].type
    };
    
    // Extract image processing options (if provided in custom_fields)
    const options = {};
    
    if (params[3].custom_fields) {
      // Look for custom fields containing image processing options
      for (const field of params[3].custom_fields) {
        switch (field.key) {
          case 'maxWidth':
            options.maxWidth = parseInt(field.value, 10) || 1200;
            break;
          case 'maxHeight':
            options.maxHeight = parseInt(field.value, 10) || 1200;
            break;
          case 'quality':
            options.quality = parseInt(field.value, 10) || 80;
            break;
          case 'convertToJpg':
            options.convertToJpg = field.value === 'true' || field.value === true;
            break;
          case 'processImages':
            options.processImages = field.value === 'true' || field.value === true;
            break;
        }
      }
    }
    
    // Log upload info
    console.log(`Processing media upload: ${mediaObjParams.name} (${mediaObjParams.type})`);
    if (Object.keys(options).length > 0) {
      console.log('Image processing options:', options);
    }
    
    // Create and save media object
    const mediaObject = new MediaObject(mediaObjParams, options);
    const result = await mediaObject.save();
    
    // Log result
    console.log(`Media object saved: ${result.url} (${Math.round(result.size / 1024)} KB)`);
    
    // Return result to client in format expected by MetaWeblog API
    return {
      url: result.url,
      name: result.name,
      type: result.type
    };
  } catch (error) {
    console.error('Error in newMediaObject:', error);
    return {
      faultCode: 500,
      faultString: `Error uploading media: ${error.message}`
    };
  }
};