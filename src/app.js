const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const Eureka = require('eureka-js-client').Eureka;
const cors = require('cors');  // Ajoutez cette ligne pour utiliser le middleware CORS

function generateAuthToken(user) {
    const token = jwt.sign({ _id: user._id, username: user.username }, 'votre_clé_secrète');
    return token;
}

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware pour analyser les requêtes JSON
app.use(bodyParser.json());

// Utilisation du middleware CORS
app.use(cors());  // Ajoutez cette ligne pour permettre les requêtes CORS

// Connexion à la base de données MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/users', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connecté à la base de données MongoDB');
}).catch(err => {
    console.error('Erreur de connexion à la base de données :', err);
    process.exit(1);
});

// Schéma et modèle MongoDB pour les livres
const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String } ,
    etat: { type: Number, default: 0 }
});

// Configuration d'Eureka Client
// Configuration d'Eureka Client
const client = new Eureka({
    instance: {
        app: 'app', // Le nom de votre service
        hostName: 'localhost', // Adresse IP de votre service Node.js
        ipAddr: '127.0.0.1', // Adresse IP de votre service Node.js
        port: {
            '$': PORT,
            '@enabled': 'true',
        },
        vipAddress: 'app', // Le nom de votre service Eureka
        dataCenterInfo: {
            '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
            name: 'MyOwn',
        },
    },
    eureka: {
        host: 'localhost', // L'adresse de votre Eureka Server
        port: 8761, // Le port par défaut d'Eureka Server
        servicePath: '/eureka/apps/',
    },
});

app.get('/', (req, res) => {
    res.send('Bienvenue sur le microservice Node.js.');
});

client.logger.level('debug');
client.start();

client.on('started', () => {
    console.log('Service enregistré avec succès auprès d\'Eureka.');
});

const User = mongoose.model('User', userSchema);

module.exports = User;
// Route d'inscription (signUp)
app.post('/signIn', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Recherchez l'utilisateur dans la base de données par nom d'utilisateur
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ message: 'Nom d\'utilisateur incorrect.' });
        }

        // Check if the user's etat is 1 (accepted)
        if (user.etat !== 1) {
            return res.status(401).json({ message: 'L\'utilisateur n\'a pas encore été accepté.' });
        }

        // Comparez le mot de passe stocké avec le mot de passe fourni
        if (password !== user.password) {
            return res.status(401).json({ message: 'Mot de passe incorrect.' });
        }

        // Generate and send the authentication token
        const token = generateAuthToken(user);
        res.status(200).json({ message: 'Connexion réussie', token });
    } catch (error) {
        res.status(500).json({ message: 'Une erreur est survenue lors de la connexion.' });
    }
});

// Route d'inscription (signUp)
app.post('/users', async (req, res) => {
    const { username, password, email } = req.body;

    try {
        // Vérifiez si l'utilisateur existe déjà
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            return res.status(400).json({ message: 'Cet utilisateur existe déjà.' });
        }

        // Créez un nouvel utilisateur
        const newUser = new User({ username, password, email });

        // Enregistrez le nouvel utilisateur
        await newUser.save();

        res.status(201).json({ message: 'Inscription réussie' });
    } catch (error) {
        console.error('Erreur d\'inscription :', error);
        res.status(500).json({ message: 'Une erreur est survenue lors de l\'inscription.' });
    }
});
// Ajoutez une route pour accéder à la table "User"
app.get('/user', async (req, res) => {
    try {
        // Utilisez Mongoose ou un autre ORM pour récupérer les données de la table "User"
        const users = await User.find();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des utilisateurs.' });
    }
});

// ... (votre code existant)

// Route pour accepter un utilisateur
app.put('/api/users/accept/:userId', async (req, res) => {
    const userId = req.params.userId;

    try {
        // Mettez à jour l'état de l'utilisateur à 1 dans la base de données
        await User.findByIdAndUpdate(userId, { $set: { etat: 1 } });

        res.status(200).json({ message: 'L\'utilisateur a été accepté avec succès.' });
    } catch (error) {
        console.error('Erreur lors de l\'acceptation de l\'utilisateur :', error);
        res.status(500).json({ message: 'Une erreur est survenue lors de l\'acceptation de l\'utilisateur.' });
    }
});

// Route pour refuser un utilisateur
// Route pour refuser un utilisateur
app.delete('/api/users/reject/:userId', async (req, res) => {
    const userId = req.params.userId;

    try {
        // Supprimez l'utilisateur de la base de données
        await User.findByIdAndRemove(userId);

        res.status(200).json({ message: 'L\'utilisateur a été refusé avec succès.' });
    } catch (error) {
        console.error('Erreur lors du refus de l\'utilisateur :', error);
        res.status(500).json({ message: 'Une erreur est survenue lors du refus de l\'utilisateur.' });
    }
});



app.get('/', (req, res) => {
    res.send('Bienvenue sur le microservice Node.js.');
});
app.listen(PORT, () => {
    console.log(`Serveur en cours d'écoute sur le port ${PORT}`);
});