const mongoose = require('mongoose');

/**
 * A breed and its list of sub-breeds, mirroring the shape of dogs.json:
 *   { "bulldog": ["boston", "french"] }
 * becomes
 *   { name: "bulldog", subBreeds: ["boston", "french"] }
 *
 * Names are stored lowercase + trimmed so that "Pug" and "pug" are the same breed.
 */
const breedSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Breed name is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    subBreeds: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// Return clean JSON to the client: expose `name`/`subBreeds`, hide Mongo internals.
breedSchema.set('toJSON', {
  virtuals: false,
  versionKey: false,
  transform(_doc, ret) {
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('Breed', breedSchema);
