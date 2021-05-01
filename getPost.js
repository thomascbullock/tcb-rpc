const path = require('path');
const PostBuilder = require('./posts_meta_builder').PostFromFile;
const auth = require('./auth').auth;
const authError = require('./auth').authError;

exports.getPost = async function(params){
	if (!auth(params)) {
		return authError();
	}
	const file = `posts/${params[0]}.md`;
	const postBuilder = new PostBuilder(file, 'editor');
	const post = await postBuilder.readPost();
	const postId = `${post.dateTime.replace(/-/g, "")}-${
		  post.slug
		}`;
	const postToReturn = {
	dateCreated: post.dateTime,
	  description: post.body,
	  title: post.title,
	  categories: [post.type],
	  postid: postId,
	  link: path.join(
		"https://thomascbullock.com/posts",
		post.path,
		post.slug
	  ),
	  slug: post.slug,
	  dateTime: post.dateTime,
	};
	
	return postToReturn;
}