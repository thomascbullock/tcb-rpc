const xmlrpc = require("xmlrpc");
const jsontoxml = require("jsontoxml");
const fs = require("fs");

var server = xmlrpc.createServer({ host: "localhost", port: 9090 });
// Handle methods not found

server.on("NotFound", function (method, params) {
  console.log("Method " + method + " does not exist");
  console.log(method);
  console.log(params);
  console.log(JSON.stringify(this));
});
// Handle method calls by listening for events with the method call name

server.on("metaWeblog.getRecentPosts", function (err, params, callback) {
  const blogid = params[0];
  const username = params[1];
  const password = params[2];
  const count = params[3];

  if (!username || !password) {
    callback(
      {
        faultCode: 403,
        faultString: "Incorrect username or password.",
      },
      null
    );
  }

  const description = `To my surprise, I have something in common with Katy Perry (apart from the whole "kissing a girl and liking it" thing). In a [recent profile by the New York Times][nyt], they announced her current slogan as "i know nothing", uncapitalized in the name of authenticity. There's apparently something in the air - Miley Cyrus also recently [caught a bout of restraint][mc], having discovered self righteousness is as powerful a drug as any other on the market.
  
  But where was I? Ah yes, "i know nothing (sic)". I don't wish to have that printed on t-shirts or in my Twitter bio, but it does describe my frame of mind this week. Next Saturday, I'll leave Fort Collins and move to Seattle, to begin a new job with Amazon. Everyone's reaction when I mention this is to ask "are you excited?" And I have no idea. The main thing I am is baffled - when will they realize their mistake? When will Ashton Kutcher jump out and explain I've been Punk'd? There's no false modesty in this, incidentally - I'm not feeling unworthy, just really confused, as if I'd been told I've got a new job as the back of someone's neck. How did this happen?! i know nothing.
  
  To make a list of people and places I will miss is a fool's errand, as I will inevitably forget someone and accidentally upset them. But the fact that I will miss anyone/anything at all has genuinely surprised me over the past few days. Had you asked me a week ago, I'd have thought about it and confidently said that, while I love my friends and family around here, I'm still a single 28 year old, and the __only__ good thing about that is the ability to move anywhere for any opportunity at any time. But as reality has set in, I'm unexpectedly somber. You all have made more of a mark on me than I'd thought, Fort Collins.
  
  In a few weeks, when I'm settled and doing less wandering around in a daze, I'll write something more reflective. But while I'm caught between being elated at a wonderful new opportunity and confused about leaving behind so many people I care about, I'll be honest that I don't have anything more to say than that. I'm super excited about everything that lies ahead, and I wish I could take you all with me. 
  
  One apropos thing was pointed out to me recently - several years ago, after a year and a half on the front lines at ADP, I had the chance to work on upgrading all of our clients to a new product, in a project which put my career on the map in a way it hadn't been previously. It's fitting, then, that the very last thing I've worked on there, 6 years later, is another new product which replaces it. Life very occasionally ties itself in a neat bow.
  
  Here's to the future! i know nothing. 	
  
  T
  
  (p.s. a logistical note - I leave Colorado next Saturday, July 8th. If you're reading this, we should see each other before then.)
  
  [nyt]: https://www.nytimes.com/2017/06/14/arts/music/katy-perry-witness-interview.html
  [mc]: http://www.billboard.com/articles/news/magazine-feature/7783997/miley-cyrus-cover-story-new-music-malibu
	`;
  const post = {
    dateCreated: "2017-06-29",
    description: description,
    link: "https://thomascbullock.com/posts/2021/04/10/on-fading-west",
    permaLink: "https://thomascbullock.com/posts/2021/04/10/on-fading-west",
    postid: "123",
    title: "On Fading West",
    userid: "T",
  };
  const responseArr = [];
  responseArr.push(post);
  console.log(params);
  callback(null, responseArr);
});

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

server.on("metaWeblog.getCategories", function (err, params, callback) {
  const categoriesObj1 = {
    categoryName: "Long",
  };
  const categoriesObj2 = {
    categoryName: "Short",
  };
  const categoriesObj3 = {
    categoryName: "Photo",
  };
  const categoriesArr = [];
  categoriesArr.push(categoriesObj1);
  categoriesArr.push(categoriesObj2);
  categoriesArr.push(categoriesObj3);
  callback(null, categoriesArr);
});
