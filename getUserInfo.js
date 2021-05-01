const auth = require('./auth').auth;
const authError = require('./auth').authError;

exports.getUserInfo = async function(params){
	if (!auth(params)) {
		return authError();
	  }
	  
	  return {
		  userid: 1,
		  nickname: 'T',
		  firstname: 'Thom',
		  lastname: 'Bullock',
		  url: 'https://thomascbullock.com'
	  }
}