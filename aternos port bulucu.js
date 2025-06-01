// MazaratHackTeam Aternos Server Port & IP Resolver
// Yıl: 2025, Dünya
// Amaç: Aternos sunucularının (örneğin, kullaniciadi.aternos.me)
//       arkasındaki gerçek IP adreslerini ve oyun portlarını bulmak.
// Yöntem: DNS SRV (_minecraft._tcp) kayıtlarını sorgulamak ve hedefleri çözmek.
// Not: Bu script, Aternos sunucusu ÇEVRİMİÇİ olduğunda ve DNS kayıtları
//      doğru şekilde yayınlandığında en iyi sonucu verir.

const dns = require('dns').promises;

// --- Renkli Konsol Çıktıları ---
const color = {
    reset: "\x1b[0m", bright: "\x1b[1m", dim: "\x1b[2m",
    fg: {
        red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", blue: "\x1b[34m",
        magenta: "\x1b[35m", cyan: "\x1b[36m", white: "\x1b[37m", gray: "\x1b[90m",
        lightRed: "\x1b[91m", lightGreen: "\x1b[92m", lightYellow: "\x1b[93m", lightBlue: "\x1b[94m"
    }
};

function logInfo(message) { console.log(`${color.fg.cyan}[INFO] ${message}${color.reset}`); }
function logSuccess(message) { console.log(`${color.fg.green}${color.bright}[SUCCESS] ${message}${color.reset}`); }
function logWarning(message) { console.log(`${color.fg.yellow}[WARNING] ${message}${color.reset}`); }
function logError(message) { console.log(`${color.fg.red}${color.bright}[ERROR] ${message}${color.reset}`); }
function logAttempt(message) { console.log(`${color.fg.blue}[ATTEMPT] ${message}${color.reset}`); }
function logResult(hostname, ip, port) {
    console.log(`  ${color.fg.lightGreen}🎯 Hedef:${color.reset} ${color.fg.white}${hostname}${color.reset}`);
    console.log(`     ${color.fg.lightYellow}IP Adresi:${color.reset} ${color.fg.bright}${ip}${color.reset}`);
    console.log(`     ${color.fg.lightYellow}Port:${color.reset} ${color.fg.bright}${port}${color.reset}`);
}

// --- Ana Çözümleyici Fonksiyonu ---
async function resolveAternosServer(aternosDomain) {
    if (!aternosDomain || !aternosDomain.includes('.aternos.me')) {
        logError("Geçersiz Aternos domain formatı. Örnek: 'kullaniciadi.aternos.me'");
        return;
    }

    logInfo(`Aternos sunucusu çözümleniyor: ${color.bright}${aternosDomain}${color.reset}`);
    const srvQuery = `_minecraft._tcp.${aternosDomain}`;
    logAttempt(`DNS SRV kaydı sorgulanıyor: ${color.bright}${srvQuery}${color.reset}`);

    let srvRecords;
    try {
        srvRecords = await dns.resolveSrv(srvQuery);
    } catch (error) {
        if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
            logError(`'${srvQuery}' için SRV kaydı bulunamadı.`);
            logWarning("Sunucu çevrimdışı olabilir, yanlış domain adı girilmiş olabilir veya henüz DNS kayıtları yayılmamış olabilir.");
        } else {
            logError(`SRV kaydı sorgulanırken bir DNS hatası oluştu: ${error.message} (Kod: ${error.code})`);
        }
        return;
    }

    if (!srvRecords || srvRecords.length === 0) {
        logError(`'${srvQuery}' için SRV kaydı bulunamadı veya boş döndü.`);
        logWarning("Sunucu çevrimdışı olabilir veya DNS yapılandırmasında bir sorun olabilir.");
        return;
    }

    logSuccess(`${srvRecords.length} adet SRV kaydı bulundu. Hedef IP ve portlar çözümleniyor...`);
    console.log("-----------------------------------------------------");

    let foundAnyDirectIp = false;
    for (const record of srvRecords.sort((a,b) => a.priority - b.priority || b.weight - a.weight)) {
        logInfo(`SRV Kaydı: Hedef=${color.fg.magenta}${record.name}${color.reset}, Port=${color.fg.magenta}${record.port}${color.reset}, Öncelik=${record.priority}, Ağırlık=${record.weight}`);
        logAttempt(`  '${record.name}' için A (IPv4) ve AAAA (IPv6) kayıtları çözümleniyor...`);

        try {
            const ipv4Addresses = await dns.resolve4(record.name);
            if (ipv4Addresses && ipv4Addresses.length > 0) {
                ipv4Addresses.forEach(ip => {
                    logResult(record.name, ip, record.port);
                    foundAnyDirectIp = true;
                });
            }
        } catch (err) {
            if (err.code !== 'ENODATA' && err.code !== 'ENOTFOUND') {
                 logWarning(`    IPv4 ('${record.name}') çözümlenirken hata: ${err.message}`);
            } else {
                logInfo(`    '${record.name}' için IPv4 adresi bulunamadı.`);
            }
        }

        try {
            const ipv6Addresses = await dns.resolve6(record.name);
            if (ipv6Addresses && ipv6Addresses.length > 0) {
                ipv6Addresses.forEach(ip => {
                    logResult(record.name, ip, record.port);
                    foundAnyDirectIp = true;
                });
            }
        } catch (err) {
             if (err.code !== 'ENODATA' && err.code !== 'ENOTFOUND') {
                 logWarning(`    IPv6 ('${record.name}') çözümlenirken hata: ${err.message}`);
            } else {
                 logInfo(`    '${record.name}' için IPv6 adresi bulunamadı.`);
            }
        }
        if(foundAnyDirectIp) console.log("  ---");
    }
    console.log("-----------------------------------------------------");

    if (!foundAnyDirectIp) {
        logWarning("SRV kayıtlarındaki hedefler için doğrudan IP adresi bulunamadı.");
        logInfo("SRV hedefleri CNAME olabilir veya Aternos farklı bir yönlendirme kullanıyor olabilir.");
        logInfo("Minecraft istemcisi bu SRV kayıtlarını yine de çözümleyebilir.");
        logInfo("Bulunan SRV hedefleri ve portları şunlardır:");
        srvRecords.forEach(r => console.log(`  - ${r.name}:${r.port}`));
    } else {
        logSuccess("Doğrudan IP ve Port bilgileri yukarıda listelenmiştir.");
    }
     logInfo("\nUnutmayın: Aternos sunucuları dinamik IP kullanır. Bu bilgiler sunucu yeniden başlatıldığında değişebilir.");
}


// --- Ana Çalıştırma ---
async function main() {
    console.log(color.fg.lightRed + color.bright + "╔═══════════════════════════════════════════════════════════════╗" + color.reset);
    console.log(color.fg.lightRed + color.bright + "║       MazaratHackTeam - Aternos Server IP & Port Resolver       ║" + color.reset);
    console.log(color.fg.lightRed + color.bright + "║             Hedef: Aternos Sunucu IP ve Port Tespiti            ║" + color.reset);
    console.log(color.fg.lightRed + color.bright + "╚═══════════════════════════════════════════════════════════════╝" + color.reset);
    console.log(color.fg.gray + "          discord.gg/mazarathackteam" + color.reset + "\n");

    const aternosServerDomain = process.argv[2];

    if (!aternosServerDomain || aternosServerDomain === '-h' || aternosServerDomain === '--help') {
        logError("Kullanım: node " + require('path').basename(__filename) + " <aternos_domain>");
        console.log(color.fg.yellow + "Örnek:  node " + require('path').basename(__filename) + " kullaniciadi.aternos.me" + color.reset);
        process.exit(1);
    }

    try {
        await resolveAternosServer(aternosServerDomain);
    } catch (err) {
        logError(`Kritik bir sistem hatası oluştu: ${err.message}`);
        console.error(err.stack);
    } finally {
        logInfo("\nMazaratHackTeam Aternos Çözümleme Operasyonu Tamamlandı.");
    }
}

main();