const mongoose = require('mongoose');

/**
 * An application user. Only a username + a bcrypt password hash are stored.
 * Each user owns their own set of breeds (see models/breed.js).
 */
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Never leak the password hash or Mongo internals to the client.
userSchema.set('toJSON', {
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.passwordHash;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
