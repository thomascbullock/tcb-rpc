server.on("metaWeblog.newMediaObject", function (err, params, callback) {
	  const writeResult = fs.writeFileSync(params[3].name, params[3].bits);
	  console.log(writeResult);
	  const uploadResultObj = {
		file: params[3].name,
		url: "http://localhost:9090/picture.jpg",
		type: params[3].type,
	  };
	  callback(null, uploadResultObj);
	});