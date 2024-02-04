AWS.config.Bucket = "byteart-bucket";
AWS.config.region = "us-east-2"; // Region
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
  IdentityPoolId: "us-east-2:9d8104d8-1c14-4a73-8980-660d75c9abfc"
});

// Create a new service object
var s3 = new AWS.S3({
    apiVersion: "2006-03-01",
    signatureVersion: 'v4',
    params: { Bucket: "byteart-bucket" },
});
//

function loadImages() {
    s3.listObjects(function (err, data) {
        if (err) {
          return alert("There was an error viewing your album: " + err.message);
        }
        // 'this' references the AWS.Request instance that represents the response
        var href = this.request.httpRequest.endpoint.href;
        var bucketUrl = href + "byteart-bucket" + "/";

        var photos = data.Contents.map(function (photo) {
          var photoKey = photo.Key;
          var photoUrl = bucketUrl + encodeURIComponent(photoKey);
          return photoUrl;
        });
        addImages(photos);
    });
};

function addImages(imageUrls) {
    // Get the album container
    const mosaicContainer = document.getElementById("mosaic-container");

    // Populate images
    imageUrls.forEach(url => {
      const mosaicItem = document.createElement("div");
      mosaicItem.classList.add("mosaic-item");

      const img = document.createElement("img");
      img.src = url;
      img.alt = "Mosaic Image";

      mosaicItem.appendChild(img);
      mosaicContainer.appendChild(mosaicItem);
    });
}
