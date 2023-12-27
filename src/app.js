const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const Eureka = require('eureka-js-client').Eureka;
const cors = require('cors');  // Ajoutez cette ligne pour utiliser le middleware CORS
const tokenBlacklist = [];


// Middleware pour vérifier le token
const authenticateToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: 'Accès refusé' });

    // Vérifier si le token est dans la liste noire
    if (tokenBlacklist.includes(token)) {
        return res.status(403).json({ message: 'Token invalide' });
    }

    jwt.verify(token, 'votre_clé_secrète', (err, user) => {
        if (err) return res.status(403).json({ message: 'Token non valide' });
        req.user = user;
        next();
    });
};


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
mongoose.connect('mongodb://127.0.0.1:27017/Education', {
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
    numInscrit: { type: Number, unique: true, required: true },
    username: { type: String, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String,required: true, enum: ['eleve', 'enseignant', 'admin'] } ,
    etat: { type: Number, default: 0 },
    userClasse: { type: String }
});
const eleveSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, default: 'eleve' },
    etat: { type: Number, default: 0 },
    numInscrit: { type: String, required: true, unique: true},
    userClasse: { type: mongoose.Schema.Types.ObjectId, ref: 'Classe', required: true },
});

const Eleve = mongoose.model('Eleve', eleveSchema);

const enseignantSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, default: 'enseignant' },
    matiere: { type: String },
});

const Enseignant = mongoose.model('Enseignant', enseignantSchema);

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
// creation d'un admin
async function createAdminUser() {
    try {
        // Check if the admin user already exists
        const existingAdmin = await User.findOne({ username: 'admin', role: 'admin' });

        if (!existingAdmin) {
            // Create a new admin user
            // const hashedPassword = await bcrypt.hash('admin', 10);
            const adminUser = new User({
                username: 'admin',
                numInscrit: 1,
                password: 'admin', // You should hash passwords in a real-world scenario
                email: 'admin@example.com',
                role: 'admin',
                etat: 1,  // Assuming admin is automatically accepted
            });

            // Save the admin user to the database
            await adminUser.save();

            console.log('Admin user created successfully.');
        } else {
            console.log('Admin user already exists.');
        }
    } catch (error) {
        console.error('Error creating admin user:', error);
    }
}
createAdminUser();
// Route d'inscription (signUp)
app.post('/signIn', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Vérifiez d'abord si l'utilisateur est un enseignant
        let user = await Enseignant.findOne({ username });

        if (!user) {
            // Si ce n'est pas un enseignant, vérifiez s'il s'agit d'un étudiant
            user = await Eleve.findOne({ username });
            
            // Vérifiez si l'utilisateur est un élève et si son état est actif
            if (user && user.etat !== 1) {
                return res.status(401).json({ message: 'L\'étudiant n\'est pas actif.' });
            }
        }

        if (!user) {
            // Si ce n'est pas un étudiant, vérifiez s'il s'agit d'un utilisateur régulier
            user = await User.findOne({ username });
        }

        if (!user) {
            return res.status(401).json({ message: 'Nom d\'utilisateur incorrect.' });
        }

        if (password !== user.password) {
            return res.status(401).json({ message: 'Mot de passe incorrect.' });
        }

        // Authentification réussie
        let userType = 'unknown';
        if (user instanceof Enseignant) {
            userType = 'enseignant';
        } else if (user instanceof Eleve) {
            userType = 'eleve';
        } else if (user instanceof User) {
            userType = 'user';
        }

        res.status(200).json({ message: 'Connexion réussie', userType, userId: user._id , username , password});

    } catch (error) {
        res.status(500).json({ message: 'Une erreur est survenue lors de la connexion.' });
    }
});





// Route d'inscription (signUp)
app.post('/signup', async (req, res) => {
    const { username, password, email, numInscrit, userClasse } = req.body;

    try {
        // Vérifiez si l'utilisateur existe déjà
        const existingUser = await Eleve.findOne({ username });

        if (existingUser) {
            return res.status(400).json({ message: 'Cet utilisateur existe déjà.' });
        }

        // Créez un nouvel utilisateur eleve
        const newEleve = new Eleve({
            username,
            password,
            email,
            numInscrit,
            userClasse,
        });

        // Enregistrez le nouvel utilisateur eleve
        await newEleve.save();

        res.status(201).json({ message: 'Inscription réussie' });
    } catch (error) {
        console.error('Erreur d\'inscription :', error);
        res.status(500).json({ message: 'Une erreur est survenue lors de l\'inscription.' });
    }
});



app.get('/user-statistics', async (req, res) => {
    try {
        // Count the total number of users
        const totalUsers = await User.countDocuments();

        // Count the number of active users (etat = 1)
        const activeUsers = await User.countDocuments({ etat: 1 });

        res.status(200).json({ totalUsers, activeUsers });
    } catch (error) {
        console.error('Error fetching user statistics:', error);
        res.status(500).json({ message: 'An error occurred while fetching user statistics.' });
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
})

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


// Route de déconnexion
app.post('/logout', (req, res) => {
   
    res.json({ message: 'Déconnexion réussie' });
});

app.listen(PORT, () => {
    console.log(`Serveur en cours d'écoute sur le port ${PORT}`);
});