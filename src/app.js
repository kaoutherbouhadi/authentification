// app.js

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

function generateAuthToken(user) {
    const token = jwt.sign({ _id: user._id, username: user.username }, 'votre_clé_secrète');
    return token;
  }

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware pour analyser les requêtes JSON
app.use(bodyParser.json());

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
    role: { type: String } // Ne pas définir comme "required"
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

        // Comparez le mot de passe stocké avec le mot de passe fourni
        if (password !== user.password) {
            return res.status(401).json({ message: 'Mot de passe incorrect.' });
        }

        res.status(200).json({ message: 'Connexion réussie' });
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
//client.start();
app.listen(PORT, () => {
    console.log(`Serveur en cours d'écoute sur le port ${PORT}`);
});