	const auth = require('./auth').auth;
	const authError = require('./auth').authError;
	const MediaObject = require('./mediaObject');

	exports.newMediaObject = async function(params) {
		if (!auth(params)) {
			return authError();
		}

		const mediaObjParams = {
			name: params[3].name,
			bits: params[3].bits,
			type: params[3].type
		}
		const mediaObject = new MediaObject(mediaObjParams);
		const retVal = await mediaObject.save();
		return retVal;

	}