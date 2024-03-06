const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReportCommentSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        required: true
    },
    relatedPost: {
        type: Schema.Types.ObjectId,
        ref: "Board",
        required: true
    },
    reportedComment: {
        type: Schema.Types.ObjectId,
        ref: "Comment",
        required: true
    }
});

module.exports = mongoose.model('ReportComment', ReportCommentSchema);