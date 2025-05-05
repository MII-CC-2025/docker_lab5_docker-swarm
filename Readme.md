# Lab 5. Desplegar App Contenerizada en un Clúster Swarm

En esta guía vamos a desplegar una Aplicación desarrollada con Nodejs que utiliza una base de datos
NoSQL MongoDB en un clúster Swarm. Para monitorizar los contenedores usaremos la aplicación contenerizada visualizer.


## Crear el clúster Swarm
https://docs.docker.com/engine/swarm/swarm-tutorial/

Crear 3 máquinas virtuales (ubuntu), asignarle un grupo de seguridad (sgswarm) y las denominaremos master, worker1 y worker2.

Instalamos docker en cada una de ellas. Aquí tienes un script para incluir como datos de usuario al crearla.

```
#!/bin/bash
# Install docker
apt-get update
apt-get install -y cloud-utils apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"
apt-get update
apt-get install -y docker-ce
usermod -aG docker ubuntu
```

Añade, al grupo de seguridad sgswarm, las siguientes reglas de firewall:

```

TCP port 2376 for secure Docker client communication. 
TCP port 2377. This port is used for communication between the nodes of a Docker Swarm or cluster. 
TCP and UDP port 7946 for communication among nodes (container network discovery).
UDP port 4789 for overlay network traffic (container ingress networking).
TCP port 22 to SSH into our instances remotely
```

Iniciamos el Swarm en la máquina máster

```console
$ docker swarm init

Swarm initialized: current node (sqab0b4s7an7rbnxfujwqzsjq) is now a manager.

To add a worker to this swarm, run the following command:

    docker swarm join --token SWMTKN-2-2755s1w5d5ssynkmlz1qvrorw6lox4p5f0ibjgp4mh1p038t6d-ax1xe0bdhal9pg8a8zbkvf736 10.132.0.10:2377

To add a manager to this swarm, run 'docker swarm join-token manager' and follow the instructions.

```

Unimos al Swarm los otros dos nodos como workers

```console
$ docker swarm join --token SWMTKN-2-2755s1w5d5ssynkmlz1qvrorw6lox4p5f0ibjgp4mh1p038t6d-ax1xe0bdhal9pg8a8zbkvf736 10.132.0.10:2377

This node joined a swarm as a worker.

```

Ver el estado del Swarm:

```console
docker node ls
```

## Construir la imagen de la aplicación a partir del Dockerfile

La aplicación y el resto de ficheros para esta guía están disponible en un repositorio Github.

Para clonarlo ejecuta el siguiente comando en la máquina master:


```console
git clone https://github.com/MII-CC-2025/docker_lab5_docker-swarm.git
```


### Aplicación Nodejs

Para esta guía se ha creado una aplicación Node que permite guardar enlaces de interés, utilizando express como framework web y una base de datos MongoDB para almacenarlos.

El fichero principal index.js contiene:

```js
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

webRouter.get('/delete/:id', async(req, res) => {

    const link = await Link.findOneAndDelete(req.params.id)
    if (link) {
        res.send('Deleted successfully! - <a href="/">Volver</a>');
        console.log('Link: ' + req.params.id + ' deleted successfully');
    } else {
        res.send('<p>ERROR: Link Not Deleted</p><a href="">Volver</a>');
    }
});

const server = app.listen(8080, function () {
   const port = server.address().port;
   console.log("Example app listening at port %s", port);
});
```

Los requisitos están indicados en el fichero package.json:

```json

{
  "name": "bookmarks",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/jlalvarez/node-webapp.git"
  },
  "author": "JLAM",
  "license": "ISC",
  "bugs": {
    "url": "https://github.com/jlalvarez/node-webapp/issues"
  },
  "homepage": "https://github.com/jlalvarez/node-webapp#readme",
  "description": "",
  "dependencies": {
    "ejs": "^3.1.10",
    "express": "^4.19.2",
    "mongoose": "^8.3.4"
  }
}

```

Y, en la carpeta views, contamos con la vista views/index.ejs

```html

<!DOCTYPE html>
<html>

<head>
    <title>Bookmark: Interesting Links</title>
    <meta charset="UTF8" />
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha3/dist/css/bootstrap.min.css" rel="stylesheet"
        integrity="sha384-KK94CHFLLe+nY2dmCWGMq91rCGa5gtU4mk92HdvYe+M/SXH301p5ILy+dN9+nJOZ" crossorigin="anonymous" />
</head>

<body>
    <div class="mx-auto col-8">
        <h1 class="m-b-60">Bookmark: Interesting Links</h1>

        <div class="d-flex flex-wrap">
            <% for(var i=0; i<links.length; i++) {%>
                <div class="col-3 m-2 p-2 border d-flex flex-row">
                    <div class="p-2">
                        <img src="https://friconix.com/png/fi-xnluxx-anonymous-user-circle.png" alt="user" width="50"
                            class="rounded-circle">
                    </div>
                    <div class="comment-text active w-100">
                        <div class="text-muted small">
                            <%= links[i].date %>
                        </div>
                        <div class="m-b-15">
                            <%= links[i].description %>
                        </div>
                        <div class="comment-footer">

                            <h6 class="font-medium">
                                by <%= links[i].author %>.
                            </h6>
                            <div class="text-end">
                                <a href='<%=links[i].url%>' target="_blank" class="btn btn-primary btn-sm">Visit</a>
                                <a href='/delete/<%=links[i]._id%>' class="btn btn-danger btn-sm">Delete</a>
                            </div>
                        </div>
                    </div>
                </div>
                <% } %>
                    <% if (links.length<=0) {%>
                        <p>No links at the moment!! <br />
                            Use below form to add new links</p>
                        <% } %>

        </div>


        <hr />

        <div class="mx-auto col-5">
            <h3>Add New Link</h3>
            <form action="/create" method="POST">
                <!-- Usuario input -->
                <div class="form-outline mb-2">
                    <label class="form-label" for="author">User</label>
                    <input type="text" id="author" name="author" class="form-control" required />
                </div>

                <div class="form-outline mb-2">
                    <label class="form-label" for="url">Link</label>
                    <input type="url" id="url" name="url" class="form-control" required />
                </div>

                <!-- Description input -->
                <div class="form-outline mb-2">
                    <label class="form-label" for="description">Description</label>
                    <textarea class="form-control" name="description" id="description" rows="4"></textarea>
                </div>

                <!-- Submit button -->
                <button type="submit" class="btn btn-primary btn-block mb-3">Save</button>
            </form>
        </div>

    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha3/dist/js/bootstrap.bundle.min.js"
        integrity="sha384-ENjdO4Dr2bkBIFxQpeoTz1HIcje39Wm4jDKdf19U8gI4ddQ3GYNS7NTKfAdVQSZe" crossorigin="anonymous">
        </script>
</body>

</html>


```

### Dockerfile

Además, se incluye el fichero Dockerfile para crear la imagen

```
FROM node:20

# Establecer Directorio de trabajo
WORKDIR /usr/src/app

# Copiar contenido de la Aplicación
COPY app/ ./

# Instalar dependencias
RUN npm install

# Exponer puerto 8080
EXPOSE 8080

# Ejecutar Aplicación
CMD ["node", "index.js"]

```

Ahora puedes crear la imagen con el comando: 

```console
docker build -t <username>/<dockerimage> .
```

Donde <username> debe ser sustituido por tu usuario en Docker Hub y <dockerimage> por el nombre
que se dará a la imagen. Por ejemplo, jluisalvarez/node-webapp

y subir la imagen al Docker Hub. Para ello, identificate y luego sube la imagen.

```console
docker login
```

```console
docker push <username>/<dockerimage>
```


## Docker Compose

El fichero compose.yml tiene definidos 3 servicios, una red para conectarlos y un volumen para persistir los datos
de MongoDB.

```yaml

services:
  web:
    image: <username>/<dockerimage>
    depends_on:
      - mongo
    deploy:
      replicas: 2
      restart_policy:
        condition: on-failure
      resources:
        limits:
          cpus: "0.1"
          memory: 50M
    ports:
      - "80:8080"
    networks:
      - webnet

  visualizer:
    image: dockersamples/visualizer:stable
    ports:
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    deploy:
      placement:
        constraints: [node.role == manager]
    networks:
      - webnet

  mongo:
    image: mongo
    volumes:
      - db-data:/data/db
    deploy:
      placement:
        constraints: [node.role == manager]
    networks:
      - webnet

volumes:
  db-data:

networks:
  webnet:
```


## Desplegar servicios:

Podrás desplegar los servicios ejecutando el siguiente comando:

```console
docker stack deploy -c compose.yml webapp
```

Puedes acceder al vizualizer con: http://<ip_master>:8080
Puedes acceder a la aplicación con: http://<ip_master>

## Mostrar listado de servicios y contenedores

```console
docker service ls
```

```console
docker stack ps webapp
```

## Escalar servicios

```console
docker service scale webapp_web=4
```

## Eliminar servicios

```console
docker stack rm webapp
```

## Comandos Swarm

* swarm init
* swarm join
* service create
* service inspect
* service ls
* service rm
* service scale
* service ps
* service update





