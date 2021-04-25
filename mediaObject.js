
class MediaObject {
	constructor(mediaObjectParams){
		this.name = mediaObjectParams.name;
		this.type = mediaObjectParams.type;
		this.bits = mediaObjectParams.bits;
	}
}

module.exports = MediaObject;