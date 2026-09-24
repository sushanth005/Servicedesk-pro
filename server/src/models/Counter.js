const { Schema, model } = require('mongoose');
const Counter = model('Counter', new Schema({ key: { type: String, unique: true }, seq: { type: Number, default: 0 } }));
Counter.next = async (key) => (await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { upsert: true, new: true })).seq;
module.exports = Counter;
