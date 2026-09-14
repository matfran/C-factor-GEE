The code to generate pixel-based crop cover and management factor (C-factor) predictions using crop map labels and Alpha Earth embeddings. The metod implements a simple random forest upscaling procedure in Google Earth Engine to generate C-factor values up to 10-meter resolution. Results are then downloaded to Google Drive for offline processing.

Note that the implementation first requires a representative sample of C-factors to be predicted across the area of interest (e.g. using https://github.com/matfran/C-factor-from-Sentinel-2.git). Following the creation of a representative sample, a random forest-based upscaling can be undertaken using this code.

The relevant codes are:

Extract_embeddings.js - extracts the AlphaEarth embeddings bands at C-factor sites in the sample.
C-factor_RF.js - runs the tiled random forest model to generate C-factor values.

Nte that intermediate data complilation steps need to be done locally (e.g. in Python or R) to generate a tabular dataset for GEE upscaling.
