{
  description = "Server app for SlimeVR ecosystem";

  inputs.nixpkgs.url = "nixpkgs/nixos-unstable";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  inputs.rust-overlay.url = "github:oxalica/rust-overlay";

  outputs = {
    self,
    nixpkgs,
    flake-utils,
    rust-overlay,
  }:
    flake-utils.lib.eachDefaultSystem
    (
      system: let
        overlays = [(import rust-overlay)];
        pkgs = import nixpkgs {
          inherit system overlays;
        };
        rustTarget = pkgs.rust-bin.fromRustupToolchainFile ./rust-toolchain.toml;
        nativeBuildInputs = with pkgs; [
          curl
          gcc
          openssl
          pkgconfig
          which
          zlib

          freetype
          expat
        ];
        buildInputs = with pkgs; [
        ];
      in {
        devShells.default = pkgs.mkShell {
          nativeBuildInputs =
            nativeBuildInputs
            ++ [
            ];
          buildInputs =
            buildInputs
            ++ [
              rustTarget
            ];

          shellHook = ''
            alias ls=exa
            alias find=fd
          '';
        };
      }
    );
}
