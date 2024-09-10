<?php

$dogruSifre = "md5 şifreleme"; 
$pwsalt = "md5 şifrelerken kullandığın saltı gir";
/*
örnek bir salt ile md5
$girilen_sifre = "P@$$wOrd";
$salt = substr(md5(rand()), 0, 10);
$sifreli_sifre =  $salt . $girilen_sifre;
echo "Şifrelenmiş Şifre: " . $sifreli_sifre;
echo " | salt: ". $salt;

bu koddan aldığını şifrelenmiş şifreyi $dogruSifre değişkenine, saltı ise $pwsalt değişkinene yazın
*/
session_start();

if (!isset($_SESSION['giris_yapildi']) || $_SESSION['giris_yapildi'] !== true) {
  if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST["sifre"])) {
    if (md5($pwsalt.$_POST["sifre"]) === $dogruSifre) {
      $_SESSION['giris_yapildi'] = true;
      header("Location: " . $_SERVER['PHP_SELF']); 
      exit;
    } else {
      echo "Yanlış şifre!";
    }
  }
  ?>
  <form method="post">
    Şifre: <input type="password" name="sifre">
    <input type="submit" value="Giriş Yap">
  </form>
  <?php
  exit; 
}

if (isset($_GET["cikis_yap"])) {
  session_destroy();

  $params = session_get_cookie_params();
  setcookie(session_name(), '', time() - 42000,
      $params["path"], $params["domain"],
      $params["secure"], $params["httponly"]
  );

  header("Location: " . $_SERVER['PHP_SELF']);
  exit;
}

$jsonDosya = "C:\\Users\\Administrator\\Desktop\\bestwplogger\\whatsapp_messages\\deleted_messages.json";

$jsonVeri = file_get_contents($jsonDosya);
$mesajlar = json_decode($jsonVeri, true);

$aramaTerimi = isset($_POST["arama"]) ? $_POST["arama"] : "";

?>

<!DOCTYPE html>
<html>
<head>
  <title>Silinmiş Mesajlar</title>
</head>
<body>
  <h2>Silinmiş Mesajlar</h2>

  <!-- Çıkış Yap butonu -->
  <a href="?cikis_yap">Çıkış Yap</a>

  <form method="post">
    <input type="text" name="arama" placeholder="Arama..." value="<?php echo $aramaTerimi; ?>">
    <input type="submit" value="Ara">
  </form>

  <?php
  foreach ($mesajlar as $mesaj) {
    if ($aramaTerimi && 
        !strpos(strtolower($mesaj["from"]), strtolower($aramaTerimi)) &&
        (!isset($mesaj["body"]) || !strpos(strtolower($mesaj["body"]), strtolower($aramaTerimi)))) {
      continue;
    }

    echo "<div style='border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;'>";
    echo "<strong>Gönderen:</strong> " . $mesaj["author"] . "<br>";
	if (isset($mesaj["media"]) && isset($mesaj["media"]["path"])) {
		if (isset($mesaj["caption"]) && !empty($mesaj["caption"])) {
			echo "<strong>Mesaj:</strong> " . $mesaj["caption"] . "<br>";
		  } else {
			echo "Mesaj yok";
		  }
	}else {
		if (isset($mesaj["body"])) {
		  echo "<strong>Mesaj:</strong> " . $mesaj["body"] . "<br>";
		}
	}
    if (isset($mesaj["media"]) && isset($mesaj["media"]["path"])) {
        $dosyaYolu = "" . $mesaj["media"]["path"];
		$dosyaYolu = substr($mesaj["media"]["path"], 16);
        $dosyaUzantisı = strtolower(pathinfo($dosyaYolu, PATHINFO_EXTENSION));
  
        switch ($dosyaUzantisı) {
            case "mp3":
                echo "<audio controls><source src='$dosyaYolu' type='audio/mpeg'></audio>";
                break;
            case "mp4":
                echo "<video width='320' height='240' controls><source src='$dosyaYolu' type='video/mp4'></video>";
                echo "$dosyaYolu";
				break;
            case "jpg":
            case "jpeg":
            case "png":
				$imageData = base64_encode(file_get_contents($dosyaYolu));
                echo "<img src='$dosyaYolu' width='200' height='auto'>"; 
                break;
            default:
                echo "Desteklenmeyen dosya türü: $dosyaUzantisı";
        }
      }

    echo "</div>";
  }
  ?>

</body>
</html>