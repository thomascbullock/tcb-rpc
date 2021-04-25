const auth = require('./auth').auth;
const authError = require('./auth').authError;

exports.getCategories = function(params){
	if (!auth(params)) {
		return authError();
	}
	const categoriesObj1 = {
		categoryName: "long",
	  };
	  const categoriesObj2 = {
		categoryName: "short",
	  };
	  const categoriesObj3 = {
		categoryName: "photo",
	  };
	  const categoriesArr = [];
	  categoriesArr.push(categoriesObj1);
	  categoriesArr.push(categoriesObj2);
	  categoriesArr.push(categoriesObj3);
	  return categoriesArr;
}