
// Create AWS connection
AWS.config.region = REGION; // Region
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: ID_POOL,
});

// Create a new service object
var s3 = new AWS.S3({
    apiVersion: "2006-03-01",
    params: { Bucket: BUCKET_NAME },
});
//

var imgList = s3.listObjects(function (err, data) {
    if (err) {
      return alert("There was an error viewing your album: " + err.message);
    }
    // 'this' references the AWS.Request instance that represents the response
    var href = this.request.httpRequest.endpoint.href;
    var bucketUrl = href + BUCKET_NAME + "/";

    var photos = data.Contents.map(function (photo) {
      var photoKey = photo.Key;
      var photoUrl = bucketUrl + encodeURIComponent(photoKey);
      return photoUrl;
    });
    return photos
});
