# DOI e registro das versões

Oferta de Disciplinas EAM, arquivada no Zenodo pela integração com o GitHub.

## DOI conceito (todas as versões)

**10.5281/zenodo.24478308**: https://doi.org/10.5281/zenodo.24478308

Aponta sempre para a versão mais recente. Usado no README, no rodapé do site e no campo `doi` do CITATION.cff.

## DOI de cada versão

Cada DOI de versão identifica exatamente um pacote de código. Use-o onde for preciso citar a versão exata, por
exemplo no Formulário I (registro de programa de computador) e no Lattes, junto com o hash.

| Versão | Data | DOI da versão | Tag / commit | Pacote no Zenodo |
| --- | --- | --- | --- | --- |
| 1.0.1 | 2026-11-23 | [10.5281/zenodo.24478309](https://doi.org/10.5281/zenodo.24478309) | `v1.0.1` / `83f512e77b2779b98c1d87224be006d6fe3ce7e8` | `darlanmnunes/oferta-eam-ufv-v1.0.1.zip` (1.191.817 bytes) |

### Hashes do pacote 1.0.1 (arquivo .zip baixado do Zenodo)

- MD5 (o mesmo que o Zenodo mostra): `6aab4a81206f09cc9e7a374b4ad4ba3e`
- SHA-256: `4a6101a351a466c4447c586b72705626f559a1a0fd6f87727720999be4b02eff`
- SHA-512: `06456e9595683fd2acb808121d4704cd16ed19f52ecdda4ab9cf71da952d2fdc9687a955dcd4d44b94921d0c71fbcfe5f7ecc925fa67ad78eac12aa28292115a`

Para conferir: baixe o .zip da página do DOI da versão e rode `shasum -a 512 oferta-eam-ufv-v1.0.1.zip`.

## Ao publicar uma versão nova

O release publicado no GitHub gera um DOI de versão novo e mantém o DOI conceito. Acrescente uma linha na tabela, com
os hashes do pacote, e atualize `version`, `date-released` e o DOI da versão em `identifiers` no CITATION.cff.
Commits sem release, como ajustes de README ou de rodapé, não mudam nenhum DOI.
