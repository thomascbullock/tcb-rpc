const auth = require('./auth').auth;
const authError = require('./auth').authError;
const Post = require('./post');

exports.deletePost = async function(params) {
	
	//first have to reorder the parameters because this api is dumb
	
	const postid = params[1];
	const user = params[2];
	const pw = params[3];
	
	const reorderedParams = [];
	reorderedParams.push(postid);
	reorderedParams.push(user);
	reorderedParams.push(pw);
	
	if (!auth(reorderedParams)) {
		return authError();
	}	
	const postParams = {
		postid: postid
	}
	
	const post = new Post(postParams);
	await post.delete();
	return true;
	
}