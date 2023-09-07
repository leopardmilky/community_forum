const express = require('express');
const router = express.Router();

const catchAsync = require('../utils/catchAsync');
const ExpressError = require('../utils/ExpressError');
const { boardSchema } = require('../schemas');
const { isLoggedIn } = require('../middleware');

const Board = require('../models/board');
const { paging } = require('../paging');


const validateBoard = (req, res, next) => {
    const {error} = boardSchema.validate(req.body);
    if (error) {
        const msg = error.details.map(el => el.message).join(',')
        throw new ExpressError(msg, 400)
    } else {
        next();
    }
}


router.get('/', catchAsync(async (req, res) => {
    const { page } = req.query;
  try {
    const totalPost = await Board.countDocuments({});
    if (!totalPost) {
      throw Error();
    }
    let { startPage, endPage, hidePost, maxPost, totalPage, currentPage } 
    = paging(page, totalPost);
    const board = await Board.find().sort({ createdAt: -1 }).skip(hidePost).limit(maxPost);
    res.render("board/index", {
      contents: board,
      currentPage,
      startPage,
      endPage,
      maxPost,
      totalPage,
    });
    } catch (error) {
        res.render("board/index", { contents: board });
    }
}));

router.get('/new', isLoggedIn, (req, res) => {
    res.render('board/new');
});

router.post('/', isLoggedIn, validateBoard, catchAsync(async (req, res) => {
    const board = new Board(req.body.board);
    await board.save();
    // req.flash('success', '게시글 등록 완료!');
    res.redirect(`/index/${board._id}`);
}));

router.get('/:id', catchAsync(async (req, res) => {
    const board = await Board.findById(req.params.id).populate('comments'); // populate()가 있어야 ref
    res.render('board/show', {items: board});
}));

router.get('/:id/edit', isLoggedIn, catchAsync(async (req, res) => {
    const board = await Board.findById(req.params.id);
    res.render('board/edit', {content: board});
}));

router.put('/:id', isLoggedIn, validateBoard, catchAsync(async (req, res) => {
    const {id} = req.params;
    const board = await Board.findByIdAndUpdate(id, req.body.board); // {...req.body.board} ???
    res.redirect(`/index/${board._id}`);
}));

router.delete('/:id', isLoggedIn, catchAsync(async (req, res) => {
    const {id} = req.params;
    await Board.findByIdAndDelete(id);
    res.redirect('/index');
}));

module.exports = router;