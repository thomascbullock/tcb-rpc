const auth = require('./auth').auth;
const authError = require('./auth').authError;
const Post = require('./post');

exports.editPost = async function(params) {
	if (!auth(params)) {
		return authError();
	}
	
	const postParams = {
		description: params[3].description,
		title: params[3].title,
		categories: params[3].categories,
		link: params[3].link,
		postid: params[0]
	}
	
	if (params[3].custom_fields){
		for (let i = 0; i < params[3].custom_fields.length; i++) {
			console.log(params[3].custom_fields[i]);
			const paramKey = params[3].custom_fields[i].key;
			const paramValue = params[3].custom_fields[i].value;
			postParams[paramKey] = paramValue;
		}
	}
	const post = new Post(postParams);
	await post.save();
	
	return 'success';
}