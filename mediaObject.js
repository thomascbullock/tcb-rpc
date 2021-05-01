const fs = require('fs-extra');
const path = require('path');

class MediaObject {
	constructor(mediaObjectParams){
		this.name = mediaObjectParams.name;
		this.type = mediaObjectParams.type;
		this.bits = mediaObjectParams.bits;
	}
	
	async save(){
		await fs.writeFile(path.join('img', this.name), this.bits);
		const resultObj = {
			name: this.name,
			url: `/img/${this.name}`,
			type: this.type
		}
		return resultObj;
	}
}

module.exports = MediaObject;