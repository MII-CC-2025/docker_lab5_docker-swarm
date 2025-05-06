console.log("Express Application");

const express = require("express");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true })) 

const mongoose = require('mongoose');
const urlmongo = 'mongodb://mongo/linkdb';

const DB = mongoose.connect(urlmongo)
                .then(() => {
                console.log('Database connection successful')
                })
                .catch(err => {
                console.error('Database connection error')
                })

const linkSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    author: String,
    url: String,
    description: String,
    date: String
});
const Link = mongoose.model('Link', linkSchema);

app.set('view engine', 'ejs');

app.get('/',  async (req, res) => {

    const links = await Link.find({});

    if(links){
        res.render('index.ejs', {'links': links});
    }else{
        return res.send({
            message: 'No hay links'
        });
    }

});

const webRouter = express.Router();
const apiRouter = express.Router();
app.use('/', webRouter);
app.use('/api', apiRouter);


webRouter.get('/list', async (req, res) => {
    const links = await Link.find({});
      
    if(links){
        res.json({'links': links});
    }else{
        return res.send({
            message: 'No hay links'
        });
    }
});


webRouter.post('/create', async (req, res) => {
    const d = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

    const l = new Link(
        {
            _id: new mongoose.Types.ObjectId(),
            //_id: new mongoose.mongo.ObjectId(),
            author: req.body.author,
            url: req.body.url,
            description: req.body.description,
            date: d.toLocaleDateString('es-ES', options)
        }
    );

    const link = await l.save();

    if (link) {
        res.send('Link Created successfully - <a href="/">Volver</a>'); 
        console.log('Link: ' + link.url + ' Created successfully');
        
    } else {
        res.send('<p>ERROR: Link Not Created</p><a href="">Volver</a>');
    }
});

webRouter.get('/delete/:_id', async(req, res) => {

    const link = await Link.findByIdAndDelete(req.params._id)
    if (link) {
        res.send('Deleted successfully! - <a href="/">Volver</a>');
        console.log('Link: ' + req.params._id + ' deleted successfully');
    } else {
        res.send('<p>ERROR: Link Not Deleted</p><a href="">Volver</a>');
    }
});

const server = app.listen(8080, function () {
   const port = server.address().port;
   console.log("Example app listening at port %s", port);
});