V481B — correctif compilation SpeechRecognitionPlugin

Remplacer uniquement :
ios/App/App/SpeechRecognitionPlugin.swift

Correction : requestPermissions(...) surcharge une méthode publique de CAPPlugin ; elle doit donc être déclarée override public.

Aucun autre fichier n'est modifié.
