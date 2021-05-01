const auth = require('./auth').auth;
const authError = require('./auth').authError;
const Post = require('./post');

exports.newPost = async function(params) {
	if (!auth(params)) {
		return authError();
	}
	
	const postParams = {
		description: params[3].description,
		title: params[3].title,
		categories: params[3].categories,
		link: params[3].link,
	}
	
	if (params[3].custom_fields){
		for (let i = 0; i < params[3].custom_fields.length; i++) {
			console.log(params[3].custom_fields[i]);
			const paramKey = params[3].custom_fields[i].key;
			const paramValue = params[3].custom_fields[i].value;
			postParams[paramKey] = paramValue;
		}
	}
	
	if (!postParams.dateTime){
		const isoDate = new Date(Date.now());
		const isoString = isoDate.toISOString();
		console.log(isoString);
		postParams.dateTime = isoString.substring(0,10);
	}
	
	if (!postParams.slug){
		 postParams.slug = postParams.title.replace(/\s+/g, "-").toLowerCase();
	}
	
	postParams.postid = `${postParams.dateTime.replace(/-/g, "")}-${
		  postParams.slug
		}`;

	const post = new Post(postParams);
	await post.save();
	return postParams.postid;
	
}