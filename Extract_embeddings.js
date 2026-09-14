var name_export = 'LUCAS_2022_AE_embeddings_v2';
var points_in = LC_2022;

var dataset = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL')
              .filterDate('2022-01-01', '2023-01-01')
              .filterBounds(points_in);


// Function to extract band values for each point
var extractValues = function(image) {
  return image.reduceRegions({
    collection: points_in,
    reducer: ee.Reducer.first(),
    scale: 10,
    tileScale: 16
  });
};

// Extract values for all images in the collection
var pointsWithValues = dataset.map(extractValues).flatten();

// Filter the collection to remove features with invalid A00 values
var filteredPoints = pointsWithValues.filter(ee.Filter.notNull(['A00']));

// Export to CSV
Export.table.toDrive({
  collection: filteredPoints,
  description: name_export,
  folder: 'GEE_LUCAS_2018_embeddings',
  fileNamePrefix: name_export,
  fileFormat: 'CSV',
  selectors: null  // Export all properties
});
