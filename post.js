const fs = require('fs-extra');
const path = require('path');

class Post {
	constructor(postParams){
		this.dateTime = postParams.dateTime;
		this.description = postParams.description;
		this.title = postParams.title;
		this.categories = postParams.categories;
		this.link = postParams.link;
		this.postid = postParams.postid;
		this.slug = postParams.slug;
	}
	
	async save(){
		
		const postMeta = {
			dateTime: this.dateTime,
			type: this.categories[0],
			title: this.title||'',
			slug: this.slug
		}
		
		const postFile = `--- \n ${JSON.stringify(postMeta)} \n---\n${this.description}`;
		
		const postFileName = `${this.postid}.md`;
		await fs.writeFile(path.join('posts',postFileName),postFile);
		
	}
	
	async delete(){
		const postFileName = `${this.postid}.md`;
		await fs.remove(path.join('posts',postFileName));
	}
	
}

module.exports = Post;