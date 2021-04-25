exports.auth = function(params){
	if (params[1] !== process.env.BLOG_USER) {
		return false;
	};
	if (params[2] !== process.env.BLOG_PW) {
		return false;
	}
	
	return true;
}

exports.authError = function() {
	return {
			faultCode: 403,
			faultString: "Incorrect username or password."
	}
};