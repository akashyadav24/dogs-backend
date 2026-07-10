const mongoose = require('mongoose');

/**
 * A breed and its list of sub-breeds, owned by a single user.
 *   { "bulldog": ["boston", "french"] }  ->  { name, subBreeds }
 *
 * Names are stored lowercase + trimmed. Uniqueness is per-user (compound index
 * on userId + name), so two different users can each have a "pug" and edit it
 * independently.
 */
const breedSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Breed name is required'],
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

// A breed name is unique per user (not globally).
breedSchema.index({ userId: 1, name: 1 }, { unique: true });

// Return clean JSON: expose name/subBreeds/timestamps, hide Mongo internals + owner.
breedSchema.set('toJSON', {
  virtuals: false,
  versionKey: false,
  transform(_doc, ret) {
    delete ret._id;
    delete ret.userId;
    return ret;
  },
});

module.exports = mongoose.model('Breed', breedSchema);
