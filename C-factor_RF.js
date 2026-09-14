/*
The script to implement a random forest model in Google Earth Engine 
to predict pixel-wise C-factor values. The model needs a tabular dataset
from a sample of sites with pre-calculated C-factor values and associated 
predictive features. In this case, these predictive features correspond to 
EU crop map labels and Alpha Earth embeddings.

This example shows a pan-EU application using LUCAS Copernicus. However, with 
an alternative sample design, the model can be implemented anywhere in the World with
alternative cropmap labels and AlphaEarth embeddings, or using only AlphaEarth embeddings.
*/

//LC_Cfactor is the C-factor values and corresponding features for LUCAS Copernicus (2018 and 2022)
//modify dates to cover 2018 or 2022
var start_date = '2022-01-01';
var end_date = '2023-01-01';
var year = "2022";

var sampled_points = ee.FeatureCollection(LC_Cfactor);
sampled_points = sampled_points.randomColumn('random');
var sampled_points = sampled_points.filter(ee.Filter.neq('C-factor', null));
//downsampling to allow RF model to work on smaller data sample but keep all arable
var sampled_points_NA = sampled_points.filter(ee.Filter.gt('Label_lev2_code', 299)).filter(ee.Filter.lt('random', 0.5));
var sampled_points_A = sampled_points.filter(ee.Filter.lt('Label_lev2_code', 299));
var sampled_points = sampled_points_A.merge(sampled_points_NA);

// Get the full EU Crop Map extent
var eu_cm = ee.ImageCollection('JRC/D5/EUCROPMAP/V1').filterDate(
    start_date, end_date).first();
var full_extent = eu_cm.geometry();

// Get bounds as client-side object
var bounds = full_extent.bounds();
var coords = bounds.coordinates().get(0).getInfo();


var target = "C-factor";
                    
                  
var featureBands = ['Label_lev2_code', 'A05', 'A43', 'A38', 'A46', 'A10', 'A51', 'A42',
                    'A07', 'A57', 'A03', 'A61', 'A52', 'A41', 'A15', 'A59', 'A31', 'A40',
                    'A58', 'A21', 'A39'];
            
var embed_bands = ['A05', 'A43', 'A38', 'A46', 'A10', 'A51', 'A42',
                  'A07', 'A57', 'A03', 'A61', 'A52', 'A41', 'A15', 'A59', 'A31', 'A40',
                  'A58', 'A21', 'A39'];
// Extract coordinates
var minLon = coords[0][0];
var minLat = coords[0][1];
var maxLon = coords[2][0];
var maxLat = coords[2][1];

var lonRange = maxLon - minLon;
var latRange = maxLat - minLat;

//10 for 100m, 20 for 10m
var chunks = 10;
var overlap = 0.0005; // add overlap

var tiles = [];
for (var i = 0; i < chunks; i++) {
  for (var j = 0; j < chunks; j++) {
    var x1 = minLon + (i * lonRange / chunks) - overlap;
    var x2 = minLon + ((i + 1) * lonRange / chunks) + overlap;
    var y1 = minLat + (j * latRange / chunks) - overlap;
    var y2 = minLat + ((j + 1) * latRange / chunks) + overlap;
    
    // Clamp to original bounds to avoid going outside study area
    x1 = Math.max(x1, minLon);
    x2 = Math.min(x2, maxLon);
    y1 = Math.max(y1, minLat);
    y2 = Math.min(y2, maxLat);
    
    var tile = ee.Geometry.Rectangle([x1, y1, x2, y2]);
    tiles.push(tile);
  }
}


// Train the model once (outside the loop)
//var sampledRandom = sampled_points.randomColumn('random');
//var training = sampledRandom.filter(ee.Filter.lt('random', 0.7));
var training = sampled_points;
var model = ee.Classifier.smileRandomForest({
  numberOfTrees: 50,
  variablesPerSplit: null,  // max_features: None means use all features
  minLeafPopulation: 4,     // min_samples_leaf: 4
  bagFraction: 0.5,         // max_samples: 0.5
  maxNodes: null,           // max_leaf_nodes: None means no limit
  seed: 0                   // For reproducibility (equivalent to random_state=0)
})
.setOutputMode('REGRESSION')
.train({
  features: training,
  classProperty: target,
  inputProperties: featureBands
});
  
var tiles2 = ee.FeatureCollection(tiles);
Map.addLayer(tiles2);

// Process each tile
for (var k = 0; k < tiles.length; k++) {
  
  
  var tile = tiles[k];
  var tile_name = 'tile_' + (k + 1);
                  
  var embed = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL')
              .filterDate(start_date, end_date)
              .filterBounds(tile)
              .select(embed_bands)
              .mosaic();
  
  median_ = embed.addBands(eu_cm.select(['classification']).rename('Label_lev2_code'));
    
  // Mask non-cropland pixels
  var mask = median_.select('Label_lev2_code').gte(200)
                  .and(median_.select('Label_lev2_code').lt(501))
                  .and(median_.select('Label_lev2_code').neq(0))
                  .and(median_.select('Label_lev2_code').eq(median_.select('Label_lev2_code')));
                
  var median_ = median_.updateMask(mask);
  var median_ = median_.select(featureBands);
  
  // Classify and nullify zero values
  var prediction = median_.classify(model).updateMask(mask);

  
  // Export each tile
  var resampled = prediction.select('classification')
  .reduceResolution({
    reducer: ee.Reducer.mean(), 
    maxPixels: 1024
  })
  .reproject({
    crs: 'EPSG:4326',
    scale: 100
  });
  
  Export.image.toDrive({
    image: resampled.select('classification'),
    description: tile_name + '_C_factor_' + year,
    folder: 'GEE_Exports_C_factor_Chunks_NDVI_' + year,
    region: tile,
    scale: 100,
    maxPixels: 1e13,
    crs: 'EPSG:4326',
    fileFormat: 'GeoTIFF',
    formatOptions: {
      cloudOptimized: true
    }
  });
  
  /*
  // Optional: Also export at 10m resolution if needed
  Export.image.toDrive({
     image: prediction.select('classification'),
     description: tile_name + '_C_factor_10m',
     folder: 'GEE_Exports_C_factor_Chunks_NDVI_10m_' + year,
     region: tile,
     scale: 10,
     maxPixels: 1e13,
     crs: 'EPSG:4326',
     fileFormat: 'GeoTIFF',
     formatOptions: {
       cloudOptimized: true
     }
    
   });
   */
   
}
