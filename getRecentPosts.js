const auth = require('./auth').auth;
const authError = require('./auth').authError;
const Postmaster = require('./postMaster');
const path = require('path');

exports.getRecentPosts = async function(params) {
if (!auth(params)) {
	return authError();
}

const postmaster = new Postmaster();
await postmaster.build('editor');

const postArray = [];
for (i = 0; i < postmaster.all.length; i++) {
	const category = postmaster.all[i].type;
	const categoryArr = [];
	categoryArr.push(category);
	const postId = `${postmaster.all[i].dateTime.replace(/-/g, '')}-${postmaster.all[i].slug}`;
	const postToPush = {
		dateCreated: postmaster.all[i].dateTime,
		description: postmaster.all[i].body,
		title: postmaster.all[i].title,
		categories: categoryArr,
		postid: postId,
		link: path.join('https://thomascbullock.com/posts',postmaster.all[i].path,postmaster.all[i].slug),
		slug: postmaster.all[i].slug
	}
	postArray.push(postToPush);
}

return postArray;
}